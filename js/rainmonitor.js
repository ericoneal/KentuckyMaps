  function Rainmonitoring_Put(name,token){
            const payload = {
                    POINTNAME: name,
                    token: token,
                    x: clickedX,
                    y: clickedY
                };

            $.ajax({
                url: 'https://tph4acen0e.execute-api.us-east-1.amazonaws.com/default/rainmonitor_put_agol',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(payload),
                success: function(response) {
                    console.log("POST successful:", response);
                    let data = JSON.parse(response);
                    if(data.addResults[0].success === true){
                        alert("Location submitted successfully.");
                    }
                    else{
                        alert("Failed to submit location. Try again.");
                    }
                    $('#inputName').val('');
                    $('#inputToken').val('');
                    lyrRainPoints.refresh();
                },
                error: function(xhr, status, error) {
                    console.error("POST failed:", status, error);
                    alert("Failed to submit location. Try again.");
                }
            });
    }