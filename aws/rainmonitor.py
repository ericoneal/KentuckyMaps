import json
import urllib.request
from datetime import datetime, timedelta, timezone
import boto3
from boto3.dynamodb.conditions import Key

# DynamoDB setup
dynamodb = boto3.resource('dynamodb', region_name='us-east-2')
rainpoints_table = dynamodb.Table('RAINPOINTS')
nexrain_table = dynamodb.Table('NEXRAIN')

# Define US Eastern timezone (EST/EDT)
US_EASTERN = timezone(timedelta(hours=-4))  # use -5 if not in daylight savings

ESRI_FEATURE_SERVICE_URL = "https://services3.arcgis.com/0g1gZyTiQ9uGlDEb/ArcGIS/rest/services/RAINPOINTS/FeatureServer/0"
 

def get_token():
    """Retrieve the token from the environment variable."""
    url = 'https://www.arcgis.com/sharing/oauth2/token?client_id=jbqCb7bdYg2cOZRv&client_secret=e01796f0c49b4aa4ac2f1ff9ab86ab21&grant_type=client_credentials' 
    request = urllib.request.Request(url)
    out = urllib.request.urlopen(request).read()
    print (out)
    resp_dict = json.loads(out)
    return resp_dict['access_token']



def get_points_from_esri():
    token = get_token()
    params = {
        'where': '1=1',
        'outFields': 'POINTNAME,x,y',  # adjust field names if needed
        'f': 'json',
        'token': token,
        'returnGeometry': 'false'
    }
    url = f"{ESRI_FEATURE_SERVICE_URL}?{urllib.parse.urlencode(params)}"

    with urllib.request.urlopen(url) as response:
        data = json.loads(response.read().decode('utf-8'))
        return data.get('features', [])
		
		
def lambda_handler(event, context):
    now_utc = datetime.now(timezone.utc)
    now_est = now_utc.astimezone(US_EASTERN)
    now_str = now_est.strftime('%I:%M %p').lstrip("0").replace(" 0", " ")

    # Get all rain points
    #points = rainpoints_table.scan().get('Items', [])
    points = get_points_from_esri()

    for feature in points:
        attrs = feature.get('attributes', {})
        try:
            x = float(attrs['x'])
            y = float(attrs['y'])
            pointname = attrs['POINTNAME']
        except (KeyError, ValueError):
            continue  # Skip invalid point

        x1, x2 = x - 0.01, x + 0.01
        y1, y2 = y - 0.01, y + 0.01

        url = (
            "https://nowcoast.noaa.gov/geoserver/weather_radar/wms?"
            f"SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&"
            f"QUERY_LAYERS=base_reflectivity_mosaic&LAYERS=base_reflectivity_mosaic&"
            f"INFO_FORMAT=application/json&FEATURE_COUNT=50&I=50&J=50&CRS=EPSG:3857&"
            f"WIDTH=101&HEIGHT=101&BBOX={x1},{y1},{x2},{y2}"
        )
            
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
                band1 = data["features"][0]["properties"]["Band1"]
        except Exception as e:
            print(f"Error fetching NOAA data for {attrs['POINTNAME']}: {e}")
            continue

        # Determine rain description
        if band1 == 0:
            description = "None"
        elif band1 <= 10:
            description = "None"
        elif band1 <= 25:
            description = "Light Drizzle"
        elif band1 <= 50:
            description = "Rain"
        elif band1 > 70:
            description = "Hail"
        else:
            description = "Trace"

        dbz = band1

        # Check for new rain above threshold
        has_new_rain = False
        if dbz > 20:
            yesterday = datetime.utcnow() - timedelta(days=1)
            try:
                recent = nexrain_table.query(
                    KeyConditionExpression=Key('POINTNAME').eq(attrs['POINTNAME']) &
                                           Key('DT').gt(yesterday.isoformat()),
                    Limit=50
                )
                has_new_rain = all(item.get('DBZ', 0) < 20 for item in recent.get('Items', []))
            except Exception as e:
                print(f"Error querying past rain for {attrs['POINTNAME']}: {e}")

        # Store result
        try:
            nexrain_table.put_item(Item={
                'POINTNAME': attrs['POINTNAME'],
                'DT': datetime.utcnow().isoformat(),
                'DBZ': dbz,
                'DESCRIPT': description,
                'DTString': now_str
            })
        except Exception as e:
            print(f"Error writing to DynamoDB for {attrs['POINTNAME']}: {e}")

    return {
        'statusCode': 200,
        'body': json.dumps(f'Processed {len(points)} points.')
    }
