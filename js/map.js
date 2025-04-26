let hillshadeLayer;
let swipe;
let isSwipeActive = false;
let isMeasureActive = false;
let measurement;
let distanceButton;
let layerList;

const urlStates = 'https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/0';

require([
  "esri/views/MapView", 
  "esri/WebMap",
  "esri/widgets/Home",
  "esri/widgets/Track",
  "esri/widgets/LayerList",
  "esri/widgets/Measurement",
  "esri/widgets/Expand",
  "esri/widgets/Swipe",
  "esri/layers/FeatureLayer",
  "esri/layers/WebTileLayer",
  "esri/widgets/Search"], 
  (MapView, WebMap, Home, Track, LayerList, Measurement, Expand, Swipe, FeatureLayer, WebTileLayer, Search) => {

 
    $('#startupModal').modal('show'); 


  const webmap = new WebMap({
    portalItem: {
      id: "72484fdc2ac34b019571b035243a46e8"
    }
  });


  const view = new MapView({
    map: webmap,
    container: "viewDiv"
  });

 
 
  const popupTemplate = {
    title: "{name}", 
    content: `
      <b>Status:</b> {status}<br>
      <a href="{Website_Link}" target="_blank"><img src="{image}" alt="Image" style="width: 100%; max-width: 300px;"/></a><br>
       
    `
  };

  const FLWaterfalls = new FeatureLayer({
    portalItem: {
      id: "38bb0649fae84c4ebacaacf8e0ffcb7a"  
    },
    popupEnabled: true,
    popupTemplate: popupTemplate  
  });
  const FLRRGTrails = new FeatureLayer({
    portalItem: {
      id: "0b0074df55b444849d43e1e17f3e1426"  
    },
    popupEnabled: true,
    popupTemplate: popupTemplate  
  });


 

  webmap.when(() => {
   //console.log("WebMap is loaded");

      // // Add WebTileLayer for Strava Heatmap
      // const stravaHeatmap = new WebTileLayer({
      //   urlTemplate: "http://localhost/tiles/{z}_{x}_{y}.png",
      //   title: "Strava Mountain Bike Heatmap",
      //   opacity: 0.8
      // });

      // webmap.add(stravaHeatmap);

    // Access layers
    webmap.layers.forEach((layer) => {
     //console.log("Layer title:", layer.title);
     //console.log("Layer ID:", layer.id);

      const excludedLayerTitles = ["World Dark Gray Reference", "World Dark Gray Base", "Kentucky", "States", "USA - States"];
      if (excludedLayerTitles.includes(layer.title)) {
        layer.listMode = 'hide';
      }
     

      if(layer.title === 'Hillshade'){
        hillshadeLayer = layer;
      }

    });

    // Get a specific layer by ID
    const specificLayer = webmap.findLayerById("layerIdHere");
    if (specificLayer) {
     //console.log("Found specific layer:", specificLayer.title);
    } else {
     //console.log("Layer not found.");
    }
  }).catch((error) => {
    console.error("Error loading WebMap:", error);
  });

  view.when(() => {

 

    view.constraints.geometry = view.extent; 
 
   
    // const excludedLayerTitles = ["World Dark Gray Reference", "World Dark Gray Base", "Kentucky","States"];
    layerList = new LayerList({
      view: view
    });
    const llExpand = new Expand({
      view: view,
      content: layerList,
      expanded: false
    });
    view.ui.add(llExpand, "top-right");


    measurement = new Measurement({ 
      view: view,
      linearUnit: "miles"}
    );
     
    distanceButton = document.getElementById("distance");
    distanceButton.addEventListener("click", () => {
      distanceMeasurement();
    });


  });

   
  const expandWidget = new Expand({
      view: view,
      expandIcon: "envelope",
      expanded: false
  });

  view.ui.add(expandWidget, "bottom-right");


  expandWidget.watch("expanded", function(isExpanded) {
    if (isExpanded) {
      $('#emailModal').modal('show'); 
      expandWidget.collapse();
    } else {
      $('#emailModal').modal('show'); 
      expandWidget.collapse();
    }
});

$("#closeExpandButton").on("click", function() {
    expandWidget.expanded = false;
});

  const homeBtn = new Home({
    view: view
  });

 
  view.ui.add(homeBtn, "top-left");



  const track = new Track({
    view: view
  });
  view.ui.add(track, "top-left");




  const searchWidget = new Search({
    view: view,
    includeDefaultSources: true,
    searchAllEnabled: false,
    resultGraphicEnabled: false,
    sources: [
     
      {
        layer: FLWaterfalls,
        searchFields: ["name"],
        displayField: "name",
        exactMatch: false,
        outFields: ["name"],
        name: "Waterfall",
        placeholder: "Waterfall Name"
      },
      {
        layer: FLRRGTrails,
        searchFields: ["FIRST_name"],
        displayField: "FIRST_name",
        exactMatch: false,
        outFields: ["FIRST_name"],
        name: "RRG Trails",
        placeholder: "Trail Name"
      }
    ]



  });

  view.ui.add(searchWidget, {
    position: "top-right"
  });


  searchWidget.on("select-result", function(event) {
    if(event.source.name == "Waterfall"){
      for(var i=0;i<=layerList.operationalItems.items.length -1;i++){
        if(layerList.operationalItems.items[0].title == "Kentucky Waterfalls"){
          layerList.operationalItems.items[0].visible = true;
        }
      }
 
    }
    view.goTo({
      center: event.result.feature.geometry,
      zoom: 16   
    });
  });



  const toggleButton = document.createElement("button");
  toggleButton.className = "esri-widget esri-component esri-icon-elevation-profile";
  toggleButton.style.padding = "8px";
  toggleButton.style.cursor = "pointer";


  view.ui.add(toggleButton, "top-right");


  toggleButton.addEventListener("click", toggleSwipe);



  
  function toggleSwipe() {
    if (isSwipeActive) {
      // Remove the Swipe widget
      if (swipe) {
        view.ui.remove(swipe);
        swipe.destroy(); // Cleanup
        swipe = null;
      }
      isSwipeActive = false;
      hillshadeLayer.visible = false;
      // toggleButton.innerText = "Toggle Hillshade Swipe";
    } else {
      // Add the Swipe widget
      const [topLayer, bottomLayer] = webmap.layers.toArray();
      if (!topLayer || !bottomLayer) {
        console.error("The WebMap must have at least two layers for the Swipe widget.");
        return;
      }
      hillshadeLayer.visible = true;
      swipe = new Swipe({
        view: view,
        leadingLayers: [hillshadeLayer],
        // trailingLayers: [bottomLayer],
        position: 50
      });

      view.ui.add(swipe);
      isSwipeActive = true;
      // toggleButton.innerText = "Toggle Hillshade Swipe";
    }
  }

  function distanceMeasurement() {
    
    if(isMeasureActive == false){
      measurement.activeTool = "distance";
      distanceButton.classList.add("active");
      isMeasureActive = true;
    }
    else{
      distanceButton.classList.remove("active");
      isMeasureActive = false;
      measurement.clear();
    }
 
  }



});



function SendEmail(FromEmail, Message) {
  if (!FromEmail || !Message) {
    alert("Please provide both email and message.");
    return;
  }

  $.ajax({
    url: "https://eaoemail.appspot.com/",
    method: "GET",
    data: {
      FromEmail: FromEmail,
      Message: Message
    },
    success: function (response) {
      alert("Email sent successfully!");

      // Clear the form fields
      $('#FromEmail').val('');
      $('#Message').val('');

      // Hide the modal and collapse the Expand widget
      $('#emailModal').modal('hide');
      if (typeof expandWidget !== 'undefined') {
        expandWidget.expanded = false;
      }
    },
    error: function (xhr, status, error) {
      alert("Failed to send email. Please try again.");
      console.error("Error:", error);
    }
  });
}



 