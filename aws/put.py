import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb', region_name='us-east-2')  # or your region

table = dynamodb.Table('RAINPOINTS')

response = table.put_item(
    Item={
        'POINTNAME': 'Shelbyville_Site3',
        'x': Decimal("-85.3675"),
        'y': Decimal("38.2123")
    }
)

print("Write successful:", response['ResponseMetadata']['HTTPStatusCode'] == 200)
