const express = require("express"); // Express Server
const bodyParser = require("body-parser"); //Body parser
const app = express(); // Connecting app
require("dotenv").config(); // dot environment for environment variables to access Database
const port = process.env.port1; // Getting the port number from .env
const query = require("./queries"); // Importing queries.js
const morgan = require("morgan"); // Morgan to capture routes
const billquery = require("./billing_queries"); // Impoting billing_queries.js
const multer = require("multer");
const Pool = require("pg").Pool; // postgres table pool inport
const bcrypt = require("bcrypt"); // hashing tool - bcrypt import
const validation = require("password-validator"); // Validation for password
var schema = new validation(); // Schema for setting password
const email_validation = require("email-validator"); //email validation
require("dotenv").config(); // dot environment for environment variables to access Database
var salt = bcrypt.genSaltSync(10); // Salt for adding hash
const multerS3 = require("multer-s3");
const aws = require("aws-sdk");
const date = require("date-and-time");
var Client = require("node-statsd-client").Client;
var client = new Client("localhost", 8125);
var bill_getall = 0;

//logger
const winston = require("winston");
const logging = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "app.log" })
  ]
});
/**********************************************************************************
 * Environment Variables
 *********************************************************************************/
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD
});

const due_bill = (request, response) => {
  logging.log({
    level: "info",
    message: "get_bills"
  });
  var get_all_bill_start = new Date();
  bill_getall = bill_getall + 1;
  client.count("user_count", bill_getall);
  var auth = request.headers["authorization"];

  if (!auth) {
    response.statusCode = 401;
    response.setHeader("WWW-Authenticate", 'Basic realm="Secure Area"');

    response.status(401).json({ message: "Bad request: Unauthorized" });
  } else if (auth) {
    var tmp = auth.split(" ");
    var buf = new Buffer.from(tmp[1], "base64");
    var plain_auth = buf.toString();
    var creds = plain_auth.split(":");
    var email_address = creds[0];
    console.log(email_address);
    var password = creds[1];
    pool.query(
      "SELECT email_address, password FROM users where email_address = $1",
      [email_address],
      (err, results) => {
        if (err) {
          logging.log({
            level: "error",
            message: err
          });
        } else if (results.rowCount) {
          var jsonContents = results.rows[0];
          var hash = jsonContents.password;
          if (bcrypt.compareSync(password, hash)) {
            if (
              email_address == results.rows[0].email_address &&
              bcrypt.hashSync(password, results.rows[0].password) ==
                results.rows[0].password
            ) {
              pool.query(
                "SELECT id FROM users WHERE email_address = $1",
                [email_address],
                (error, results) => {
                  const user_id = results.rows[0].id;
                  if (error) {
                    response.status(404).json({ message: "File not found" });
                  } else {
                    var select_bill_start = new Date();
                    const PS = "due";
                    pool.query(
                      "SELECT * FROM bills WHERE owner_id = $1",
                      [user_id],
                      (error, results) => {
                        if (error) {
                          logging.log({
                            level: "error",
                            message: error
                          });
                        } else if (results.rowCount) {
                          pool.query(
                            "SELECT * FROM bills WHERE paymentstatus=$1",
                            [PS],
                            (error, results) => {
                              if (error) {
                                logging.log({
                                  level: "error",
                                  message: error
                                });
                              } else if (results.rowCount) {
                                const bill_id = user_id;
                                pool.query(
                                  "SELECT * FROM users WHERE email_address =$1",
                                  [email_address],
                                  (error, res) => {
                                    if (error) {
                                      logging.log({
                                        level: "error",
                                        message: error
                                      });
                                    } else if (res.rowCount == 1) {
                                      console.log(bill_id);
                                      console.log(user_id);
                                      if (bill_id == user_id) {
                                        const days = request.params.x;
                                        const due_date =
                                          results.rows[0].due_date;
                                        const paystat =
                                          results.rows[0].paymentstatus;
                                        console.log(days);
                                        console.log(paystat);

                                        console.log(due_date);
                                        var Fromdate = new Date(
                                          new Date().getFullYear(),
                                          new Date().getMonth(),
                                          new Date().getDate()
                                        );
                                        var end = new Date(
                                          new Date().getFullYear(),
                                          new Date().getMonth(),
                                          new Date().getDate()
                                        );
                                        const FromDate = Fromdate.toLocaleDateString();
                                        end.setDate(
                                          end.getDate() + parseInt(days)
                                        );
                                        const END = end.toLocaleDateString();
                                        const DUE = due_date.toLocaleDateString();
                                        console.log(FromDate);
                                        console.log(END);
                                        console.log(DUE);

                                        const fromstring = FromDate.split("/");
                                        const endstring = END.split("/");
                                        const duestring = DUE.split("/");

                                        console.log(fromstring);
                                        console.log(endstring);
                                        console.log(duestring);

                                        var from = new Date(
                                          fromstring[2],
                                          parseInt(fromstring[0]) - 1,
                                          fromstring[1]
                                        ); // -1 because months are from 0 to 11
                                        var to = new Date(
                                          endstring[2],
                                          parseInt(endstring[0]) - 1,
                                          endstring[1]
                                        );
                                        var check = new Date(
                                          duestring[2],
                                          parseInt(duestring[0]) - 1,
                                          duestring[1]
                                        );
                                        console.log(from);
                                        console.log(to);
                                        console.log(check > from && check < to);
                                        pool
                                          .query(
                                            "SELECT * FROM bills WHERE due_date BETWEEN $1 AND $2",
                                            [from, to]
                                          )
                                          .then(results => {
                                            const res = {
                                              bills: results.rows.map(
                                                result => {
                                                  return (
                                                    result.vendor +
                                                    " : " +
                                                    "http://" +
                                                    process.env.domain_name +
                                                    "/v1/bill/" +
                                                    result.id
                                                  );
                                                }
                                              )
                                            };
                                            response
                                              .status(200)
                                              .json({ message: "Success" });
                                            console.log(results.rows);
                                            const databill = res.bills
                                              .slice(0)
                                              .join(" ");
                                            console.log("databill " + databill);

                                            var select_bill_end = new Date();
                                            var select_bill_database =
                                              select_bill_end.getMilliseconds() -
                                              select_bill_start.getMilliseconds();
                                            client.timing(
                                              "select_bill_timings",
                                              select_bill_database
                                            );

                                            aws.config.update({
                                              secretAccessKey:
                                                process.env
                                                  .aws_secret_access_key,
                                              accessKeyId:
                                                process.env.aws_access_key_id,
                                              region: process.env.aws_region
                                            });

                                            aws.config.update({
                                              region: process.env.aws_region
                                            });

                                            var sqs = new aws.SQS({
                                              apiVersion: "2012-11-05"
                                            });
                                            const body = JSON.stringify(
                                              results.rows[0]
                                            );
                                            var queueurl =
                                              process.env.sqs_queue_url;
                                            var params = {
                                              DelaySeconds: 10,
                                              MessageBody: databill,
                                              QueueUrl: queueurl
                                            };
                                            var params1 = {
                                              QueueUrl: queueurl
                                            };
                                            sqs.sendMessage(params, function(
                                              err,
                                              data
                                            ) {
                                              if (err) {
                                                console.log("Error", err);
                                              } else {
                                                console.log(
                                                  "Success",
                                                  data.MessageId
                                                );
                                              }
                                            });
                                            var params2 = {
                                              Attributes: {
                                                ReceiveMessageWaitTimeSeconds:
                                                  "20"
                                              },
                                              QueueUrl: queueurl
                                            };

                                            sqs.setQueueAttributes(
                                              params2,
                                              function(err, data) {
                                                if (err) {
                                                  console.log("Error", err);
                                                } else {
                                                  console.log("Success", data);

                                                  sqs.receiveMessage(
                                                    params1,
                                                    function(err, data) {
                                                      if (err) {
                                                        console.log(
                                                          "Receive Error",
                                                          err
                                                        );
                                                      } else {
                                                        const Bill_Json =
                                                          data.Messages[0].Body;

                                                        var topicArn =
                                                          process.env
                                                            .sns_topic_arn;
                                                        var params2 = {
                                                          Subject: email_address,
                                                          Message: Bill_Json /* required */,
                                                          TopicArn: topicArn
                                                        };
                                                        var publishTextPromise = new aws.SNS(
                                                          {
                                                            apiVersion:
                                                              "2010-03-31"
                                                          }
                                                        )
                                                          .publish(params2)
                                                          .promise();
                                                        publishTextPromise
                                                          .then(function(data) {
                                                            console.log(
                                                              `Message sent to the topic ${params2.TopicArn} with links \n${params2.Message} }`
                                                            );
                                                            console.log(
                                                              "MessageID is " +
                                                                data.MessageId
                                                            );
                                                          })
                                                          .catch(function(err) {
                                                            console.error(
                                                              err,
                                                              err.stack
                                                            );
                                                          });
                                                      }
                                                    }
                                                  );
                                                }
                                              }
                                            );
                                          });
                                      } else {
                                        response
                                          .status(400)
                                          .json({ message: "error" });
                                      }
                                    } else {
                                      response.status(400).json({
                                        message: "Bad REquest: BIll not found"
                                      });
                                    }
                                  }
                                );
                              }
                            }
                          );
                        } else {
                          response
                            .status(404)
                            .json({ message: "Bills Not found" });
                        }
                      }
                    );
                  }
                }
              );
            }
          }
        }
      }
    );
  } else {
    response.status(400).json({ message: "Bad Request: Wrong Auth" });
  }
  var get_bill_end = new Date();
  var get_billsl =
    get_bill_end.getMilliseconds() - get_all_bill_start.getMilliseconds();
  client.timing("end_of_get_request", get_billsl);
};

module.exports = { due_bill };
