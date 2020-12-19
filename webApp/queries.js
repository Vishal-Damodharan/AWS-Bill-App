/*
 * A Javascript file to GET, POST, PUT Users into Postgres Database
 */
const Pool = require("pg").Pool; // postgres table pool inport
const bcrypt = require("bcrypt"); // hashing tool - bcrypt import
const validation = require("password-validator"); // Validation for password
var schema = new validation(); // Schema for setting password
const email_validation = require("email-validator"); //email validation
require("dotenv").config(); // dot environment for environment variables to access Database
var salt = bcrypt.genSaltSync(10); // Salt for adding hash

var Client = require('node-statsd-client').Client;
var client = new Client("localhost", 8125);
var user_post = 0
var user_get = 0
var user_put = 0

//logger
const winston = require('winston');
const logging = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'app.log' })
  ]
});
/**********************************************************************************
 * Environment Variables
 **********************************************************************************/
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

//To get all users
const getUsers = (request, response) => {
  pool.query("SELECT * FROM users ORDER BY id ASC", (error, results) => {
    if (error) {
      throw error;
    }
    response.status(200).json(results.rows);
  });
};

// Add properties to it
schema
  .is()
  .min(8) // Minimum length 8
  .is()
  .max(100) // Maximum length 100
  .has()
  .uppercase() // Must have uppercase letters
  .has()
  .lowercase()
  .has()
  .symbols() // Must have lowercase letters
  .has()
  .digits() // Must have digits
  .has()
  .not()
  .spaces() // Should not have spaces
  .is()
  .not()
  .oneOf(["Passw0rd", "Password123"]);

  var user_post = 0
  var user_get = 0
  var user_put = 0
/********************************************************************************************
 * POST user
 * Authenticated
 * Fixed Endpoints
 *
 *
 *********************************************************************************************/
const createUser = (request, response) => {
  logging.log({
    level: 'info',
    message: 'post_user'
  });
  var post_start_time = new Date()
  user_post = user_post + 1;
  client.count("count_user_request_post", user_post)

  const first_name = request.body.first_name;
  const last_name = request.body.last_name;
  const email_address = request.body.email_address;
  const password = request.body.password;
  const Hashedpassword = bcrypt.hashSync(password, salt);
  const account_created = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/, "");
  const account_updated = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/, "");
  if (
    !request.body.first_name ||
    !request.body.last_name ||
    !request.body.email_address ||
    !request.body.password
  ) {
    response.status(400).json({
      message: "Please provide more information"
    });
  } else {
    if (email_validation.validate(email_address)) {
      if (schema.validate(password)) {
        pool.query(
          "SELECT * FROM users WHERE email_address = $1",
          [email_address],
          (error, results) => {
            if(error){
              logging.log({
                level: 'error',
                message: error
              });
            }
            else if (results.rowCount == 0) {
              var insert_start_time= new Date()
              pool.query(
                "INSERT INTO users (first_name, last_name, email_address, password, account_created, account_updated ) VALUES ($1, $2, $3, $4, $5, $6) ",
                [
                  first_name,
                  last_name,
                  email_address,
                  Hashedpassword,
                  account_created,
                  account_updated
                ],
                (error, results) => {
                  if (error) {
                    logging.log({
                      level: 'error',
                      message: error
                    });
                  }
                  var insert_end_time = new Date();
                  var User_insert = insert_end_time.getMilliseconds() - insert_start_time.getMilliseconds();
                  client.timing("Insert_user_timings", User_insert);
                  pool.query(
                    "SELECT id, first_name, last_name, email_address, account_created, account_updated FROM users WHERE email_address = $1",
                    [email_address],
                    (error, results) => {
                      if(error){
                        logging.log({
                          level: 'error',
                          message: error
                        });
                      }else{
                      var result_json = results.rows[0];
                      response.status(200).json(result_json);
                      }
                    }
                  );
                }
              );
            } else {
              response.status(401).json({
                message: "Username already found"
              });
            }
          }
        );
      } else {
        response.status(400).json({
          message: "invalid password"
        });
      }
    } else {
      response.status(400).json({
        message: "invalid email_address"
      });
    }
  }
  var user_post_end = new Date();
  var post_user = user_post_end.getMilliseconds() - post_start_time.getMilliseconds();
  client.timing("timing_user(ms)_request_post", post_user);
};

/************************************************************************************ */
/*GET USER by email_address
 *Authenticated
 *Fixed Endpoints
 *
 *
 *
 *
 *
 *
 *
 ****************************************************************************************/
const getoneUser = (request, response) => {
  logging.log({
    level: 'info',
    message: 'get_user'
  });
  var get_user_start = new Date();
  user_get = user_get + 1;
  client.count("user_count", user_get);

  var auth = request.headers["authorization"];
  console.log("Authorization Header is: ", auth);

  if (!auth) {
    response.statusCode = 401;
    response.setHeader("WWW-Authenticate", 'Basic realm="Secure Area"');

    response.status(400).json({
      message: "Unauthorized Request"
    });
  } else if (auth) {
    var tmp = auth.split(" ");
    var buf = new Buffer(tmp[1], "base64");
    var plain_auth = buf.toString();
    console.log("Decoded Authorization ", plain_auth);
    var creds = plain_auth.split(":");
    var email_address = creds[0];
    var password = creds[1];
    pool.query(
      "SELECT email_address, password FROM users where email_address = $1",
      [email_address],
      (err, results) => {
        if (results.rowCount) {
          if (
            email_address == results.rows[0].email_address &&
            bcrypt.hashSync(password, results.rows[0].password) ==
              results.rows[0].password
          ) {
            var select_user_start = new Date();
            pool.query(
              "SELECT id, first_name, last_name, email_address, account_created, account_updated FROM users WHERE email_address = $1",
              [email_address],
              (error, results) => {
                if(error){
                    logging.log({
                      level: 'error',
                      message: error
                    });
                }else{
                  var get_user_query_end = new Date();
                  var get_user_database = get_user_query_end.getMilliseconds() - select_user_start.getMilliseconds();
                  client.timing("get_user_timings", get_user_database);
                var result_json = results.rows[0];
                response.status(200).json(result_json);
                }
              }
            );
          } else {
            response
              .status(401)
              .json({ message: "Bad request: Password wrong" });
          }
        } else {
          response
            .status(401)
            .json({ message: "Bad request: username not found" });
        }
      }
    );
  } else {
    response.status(401).json({ message: "Bad Request: Not Authorized" });
  }
  var get_user_end = new Date();
  var get_user = get_user_end.getMilliseconds() - get_user_start.getMilliseconds();
  client.timing("end_of_get_request", get_user);
};

/******************************************************************************************/
/*PUT user 
*Authenticated
*Fixed Endpoints
*
*
*
*
/***************************************************************************************** */
const putUser = (request, response) => {
  logging.log({
    level: 'info',
    message: 'put_user'
  });
  var put_user_start = new Date();
  user_put = user_put + 1;
  client.count("user_put_start", user_put);
  var auth = request.headers["authorization"];
  const account_updated = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/, "");
  const account_created = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/, "");
  if (!auth) {
    response.status(401).json({
      message: "Missing Auth header"
    });
  } else if (auth) {
    var tmp = auth.split(" ");
    var buf = new Buffer.from(tmp[1], "base64");
    var plain_auth = buf.toString();
    var creds = plain_auth.split(":");
    var email_address = creds[0];
    var password = creds[1];
    pool.query(
      "SELECT email_address, password FROM users where email_address = $1",
      [email_address],
      (err, results) => {
        if (results.rowCount) {
          if (
            email_address == results.rows[0].email_address &&
            bcrypt.hashSync(password, results.rows[0].password) ==
              results.rows[0].password
          ) {
            const { first_name, last_name, password } = request.body;
            const hash = bcrypt.hashSync(password, salt);
            if (
              Object.keys(request.body).length == 3 &&
              request.body.hasOwnProperty("first_name") &&
              request.body.hasOwnProperty("last_name") &&
              request.body.hasOwnProperty("password")
            ) {
              if (schema.validate(password)) {
                pool.query(
                  "SELECT id, first_name, last_name, email_address, account_created, account_updated FROM users WHERE email_address = $1",
                  [email_address],
                  (error, results) => {
                    if (error) {
                      logging.log({
                        level: 'error',
                        message: error
                      });                   
                     } else if (results.rowCount) {
                      var update_start_date = new Date();
                      pool.query(
                        "UPDATE users SET first_name = $1, last_name= $2, password= $3 WHERE email_address = $4",
                        [first_name, last_name, hash, email_address],
                        (error, results) => {
                          if (error) {
                            logging.log({
                              level: 'error',
                              message: error
                            });
                          } else {
                            var update_end_date = new Date();
                            var update_user_database = update_end_date.getMilliseconds() - update_start_date.getMilliseconds();
                            client.timing("update_timings", update_user_database);
                            response
                              .status(200)
                              .json({ message: "User updated" });
                          }
                        }
                      ); //pool.query 3
                    } else {
                      response.status(401).json({
                        message: "Unauthorized Request"
                      });
                    }
                  }
                ); //pool.query 2
              } else {
                response.status(400).json({
                  message: "Bad Request: password weak"
                });
              }
            } else {
              //if obj .keys
              response.status(400).json({
                message: "Bad Request: Please set only the required fields"
              });
            }
          } else {
            //basic auth if
            response.status(401).json({
              message: "Unauthorized request: Wrong password"
            });
          }
        } else {
          //basic auth if
          response.status(401).json({
            message: "Unauthorized request: Wrong email"
          });
        }
      }
    ); //pool.query 1
  } //if auth end
  else {
    response.status(401).json({ message: "Not authorized" });
  }
  var user_put_end = new Date();
  var put_user = user_put_end.getMilliseconds() - put_user_start.getMilliseconds();
  client.timing("timing_user(ms)_request_put", put_user);
};

module.exports = { getUsers, createUser, getoneUser, putUser };
// END 
//OF 
//CODE
