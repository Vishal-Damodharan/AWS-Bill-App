const aws = require('aws-sdk')
aws.config.update({ region: "us-east-1"})
var DynamoClient = new aws.DynamoDB.DocumentClient();
const uuidv1 = require('uuid/v1')

exports.handler = (event, context, callback) => {
var email_address = event.Records[0].Sns.Subject;
var messagedata = event.Records[0].Sns.Message;
console.log("email_address" + email_address);
console.log("messagedata" + messagedata);
var params = {
    TableName: "csye6225",
    Key: {
        "email_address": email_address
    }
};
DynamoClient.get(params, function (err, data) {

    if (data.Item == undefined) {
        console.log("ITs Going in")
        console.log( JSON.stringify(err, null, 2));
        var newToken = uuidv1();
        var expireTime = Math.floor(Date.now() / 1000) + (60 * process.env.TTL_DELAY);
       
        var newData = {
            TableName: "csye6225",
            Item: {
                "email_address": email_address,
                "token": newToken,
                "TTL": expireTime
            }
        };
        DynamoClient.put(newData, function (err, data) {
            if (err) {
                console.error("Failed", email_address, ". Error JSON:", JSON.stringify(err, null, 2));
                return err;
            } else {
                console.log("Success:", email_address);
                var email = process.env.fromaddr;
                console.log("Sender email " + email);
                               
                var params = {
                    Destination: { /* required */
                        // CcAddresses: [
                        //   'EMAIL_ADDRESS',
                        //   /* more items */
                        // ],
                        ToAddresses: [
                            email_address
                            /* more items */
                        ]
                    },
                    Message: { /* required */
                        Body: { /* required */
                            Html: {
                                Charset: "UTF-8",
                                Data: messagedata
                                // Data: "HTML_FORMAT_BODY"
                            },
                            Text: {
                                Charset: "UTF-8",
                                Data: "TEXT_FORMAT_BODY"
                            }
                        },
                        Subject: {
                            Charset: 'UTF-8',
                            Data: 'email for bill'
                        }
                    },
                    Source: email, /* required */
                    //   ReplyToAddresses: [
                    //      'EMAIL_ADDRESS',
                    //     /* more items */
                    //   ],
                };

                // Create the promise and SES service object
                var sendPromise = new aws.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();

                // Handle promise's fulfilled/rejected states
                sendPromise.then(
                    function (data) {
                        console.log(data.MessageId);
                    }).catch(
                        function (err) {
                            console.error(err, err.stack);
                        });
                    

                return true;
            }
        });
    }
    else {
        console.log("Data Already present ", data.Item.token);
        return true;
    }
});
return false;
};
    