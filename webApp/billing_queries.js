const Pool = require("pg").Pool; // postgres table pool inport
const bcrypt = require("bcrypt"); // hashing tool - bcrypt import
const validation = require("password-validator"); // Validation for password
var schema = new validation(); // Schema for setting password
const email_validation = require("email-validator"); //email validation
require("dotenv").config(); // dot environment for environment variables to access Database
var salt = bcrypt.genSaltSync(10); // Salt for adding hash
const multer = require("multer");
const multerS3 = require("multer-s3");
const aws = require("aws-sdk");
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

var Client = require("node-statsd-client").Client;
var client = new Client("localhost", 8125);
var bill_post = 0;
var bill_get = 0;
var bill_getall = 0;
var bill_put = 0;
var bill_delete = 0;
var bill_get_v2 = 0;

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
/*
 * POST METHOD
 * AUTHENTICATED
 * VALIDATED
 * CLOSED ALL ENDPOINTS
 *
 *
 *
 *
 *
 *
 *
 *
 */
// define multer storage configuration
const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "application/pdf"
  ) {
    //Accept a file
    cb(null, true);
  } else {
    //reject a file
    cb(null, false);
  }
};

aws.config.update({
  secretAccessKey: process.env.aws_secret_access_key,
  accessKeyId: process.env.aws_access_key_id,
  region: process.env.aws_region
});

const s3 = new aws.S3();
const storage = multerS3({
  s3: s3,
  bucket: process.env.S3_BUCKET_APP,
  metadata: function(req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  },
  key: function(req, file, cb) {
    cb(null, Date.now().toString() + "_" + file.originalname);
  }
});

const upload = multer({ storage: storage, fileFilter: fileFilter });

const addBills = (request, response) => {
  logging.log({
    level: "info",
    message: "post_bill"
  });
  var post_start_time = new Date();
  bill_post = bill_post + 1;
  client.count("count_bill_request_post", bill_post);
  upload;
  const vendor = request.body.vendor;
  const bill_date = request.body.bill_date;
  const due_date = request.body.due_date;
  const amount_due = request.body.amount_due;
  const categories = request.body.categories;
  const paymentStatus = request.body.paymentStatus;
  var auth = request.headers["authorization"];
  const created_ts = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/, "");
  const updated_ts = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/, "");
  if (!auth) {
      logging.log({
        level: "error",
        message: "Unauthorized"
      });
    response.status(401).json({ message: "Bad request: Unauthorized" });
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
                  if (error) {
                    logging.log({
                      level: "error",
                      message: error
                    });
                  } else if (results.rowCount == 1) {
                    var user_id = results.rows[0].id;

                    if (
                      !request.body.vendor ||
                      !request.body.bill_date ||
                      !request.body.due_date ||
                      !request.body.amount_due ||
                      !request.body.categories ||
                      !request.body.paymentStatus
                    ) {
                      response.status(400).json({
                        message: "Bad request: Provide more Information"
                      });
                    } else {
                      var insert_start_time = new Date();
                      pool.query(
                        "INSERT INTO bills (created_ts, updated_ts, owner_id, vendor, bill_date, due_date, amount_due, categories, paymentStatus) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
                        [
                          created_ts,
                          updated_ts,
                          user_id,
                          vendor,
                          bill_date,
                          due_date,
                          amount_due,
                          categories,
                          paymentStatus
                        ],
                        (error, results) => {
                          if (error) {
                            logging.log({
                              level: "error",
                              message: error
                            });
                            response
                              .status(400)
                              .json({
                                message:
                                  "Bad REquest: bill already exists try with different vendor"
                              });
                          } else {
                            var insert_end_time = new Date();
                            var Bill_insert =
                              insert_end_time.getMilliseconds() -
                              insert_start_time.getMilliseconds();
                            client.timing("Insert_bill_timings", Bill_insert);
                            pool.query(
                              "SELECT * FROM bills WHERE owner_id = $1",
                              [user_id],
                              (error, results) => {
                                const billid = results.rows[0].id;
                                if (error) {
                                  logging.log({
                                    level: "error",
                                    message: error
                                  });
                                  response.status(404).json({
                                    message: "bill not found"
                                  });
                                } else {
                                  var result_json = results.rows[0];
                                  const att = results.rows[0].attachment;
                                  if (att) {
                                    pool.query(
                                      "SELECT * FROM file_meta WHERE file_bill_id = $1",
                                      [billid],
                                      (error, results) => {
                                        if (error) {
                                          logging.log({
                                            level: "error",
                                            message: error
                                          });
                                        } else if (results.rowCount == 1) {
                                          const file_id =
                                            results.rows[0].fileid;
                                          pool.query(
                                            "SELECT * FROM files WHERE id = $1",
                                            [file_id],
                                            (error, result) => {
                                              const resjson = result.rows[0];
                                              if (error) {
                                                logging.log({
                                                  level: "error",
                                                  message: error
                                                });
                                              } else if (
                                                results.rowCount == 1
                                              ) {
                                                pool.query(
                                                  "UPDATE bills SET attachment =$1 WHERE id=$2",
                                                  [resjson, file_id],
                                                  (error, results) => {
                                                    if (error) {
                                                      logging.log({
                                                        level: "error",
                                                        message: error
                                                      });
                                                    } else {
                                                      pool.query(
                                                        "SELECT * FROM bills WHERE vendor = $1",
                                                        [vendor],
                                                        (error, results) => {
                                                          const updated_value =
                                                            results.rows[0];
                                                          if (error) {
                                                            logging.log({
                                                              level: "error",
                                                              message: error
                                                            });
                                                          } else if (
                                                            results.rowCount ==
                                                            1
                                                          ) {
                                                            response
                                                              .status(201)
                                                              .json(
                                                                updated_value
                                                              );
                                                          } else {
                                                            response
                                                              .status(404)
                                                              .json({
                                                                message:
                                                                  "File not updated"
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
                                                  .json({
                                                    message: "File cannot found"
                                                  });
                                              }
                                            }
                                          );
                                        } else {
                                          response
                                            .status(404)
                                            .json({
                                              message: "File not found"
                                            });
                                        }
                                      }
                                    );
                                  } else {
                                    pool.query(
                                      "SELECT * FROM bills WHERE vendor = $1",
                                      [vendor],
                                      (error, results) => {
                                        const bi = results.rows[0];
                                        if (error) {
                                          logging.log({
                                            level: "error",
                                            message: error
                                          });
                                        } else if (results.rowCount == 1) {
                                          response.status(200).json(bi);
                                        } else {
                                          response
                                            .status(404)
                                            .json({
                                              message:
                                                "Bad Request: not updated"
                                            });
                                        }
                                      }
                                    );
                                  }
                                }
                              }
                            );
                          }
                        }
                      );
                    }
                  } else {
                    response.status(404).json({ message: "user not found" });
                  }
                }
              );
            } else {
              response
                .status(404)
                .json({ message: "email and password doesn't match" });
            }
          } else {
            response.status(404).json({ message: "password not found" });
          }
        } else {
          response.status(404).json({ message: "user not found" });
        }
      }
    );
  } else {
    response.status(404).json({ message: "Not authorized" });
  }
  var bill_post_end = new Date();
  var post_bill =
    bill_post_end.getMilliseconds() - post_start_time.getMilliseconds();
  client.timing("timing_bill(ms)_request_post", post_bill);
};

//       }
//     );
//   }
// };
/*
 * GET ALL METHOD
 * AUTHENTICATED
 * VALIDATED
 * CLOSED ALL ENDPOINTS
 *
 *
 *
 *
 *
 *
 *
 *
 */
const getAllBills = (request, response) => {
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
                          const bill_id = results.rows[0].owner_id;
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
                                if (bill_id == user_id) {
                                  var select_bill_end = new Date();
                                  var select_bill_database =
                                    select_bill_end.getMilliseconds() -
                                    select_bill_start.getMilliseconds();
                                  client.timing(
                                    "select_bill_timings",
                                    select_bill_database
                                  );
                                  response.status(200).json(results.rows);
                                } else {
                                  response
                                    .status(400)
                                    .json({ message: "error" });
                                }
                              } else {
                                response
                                  .status(400)
                                  .json({
                                    message: "Bad REquest: BIll not found"
                                  });
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
/*
 * GET METHOD
 * AUTHENTICATED
 * VALIDATED
 * CLOSED ALL ENDPOINTS
 *
 *
 *
 *
 *
 *
 *
 *
 */
const getBills = (request, response) => {
  logging.log({
    level: "info",
    message: "get_bill"
  });
  var get_bill_start = new Date();
  bill_get = bill_get + 1;
  client.count("bill_count", bill_get);
  var auth = request.headers["authorization"];
  const ids = request.params.id;

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
              var select_bill_start = new Date();
              pool.query(
                "SELECT * FROM bills WHERE id = $1",
                [ids],
                (error, results) => {
                  if (error) {
                    logging.log({
                      level: "error",
                      message: error
                    });
                    response.status(404).json({ message: "Provide proper ID" });
                  } else if (results.rowCount == 1) {
                    const bill_id = results.rows[0].owner_id;
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
                          if (bill_id == res.rows[0].id) {
                            var select_bill_end = new Date();
                            var select_bill_database =
                              select_bill_end.getMilliseconds() -
                              select_bill_start.getMilliseconds();
                            client.timing(
                              "select_bill_timings",
                              select_bill_database
                            );
                            response.status(200).json(results.rows);
                          } else {
                            response.status(404).json({
                              message: "Bad Request: User cannot access ID "
                            });
                          }
                        } else {
                          response
                            .status(404)
                            .json({ message: "File not found" });
                        }
                      }
                    );
                  } else {
                    response.status(404).json({ message: "Provide the ID" });
                  }
                }
              );
            } else {
              response
                .status(400)
                .json({ message: "email_address & password doesnt match" });
            }
          } else {
            response.status(400).json({ message: "Password not found" });
          }
        } else {
          response
            .status(400)
            .json({ message: "please provide more information" });
        }
      }
    );
  } else {
    response.status(400).json({ message: "User not authenticated" });
  }
  var get_bill_end = new Date();
  var get_billl =
    get_bill_end.getMilliseconds() - get_bill_start.getMilliseconds();
  client.timing("end_of_get_request", get_billl);
};

/*
 * PUT METHOD
 * AUTHENTICATED
 * VALIDATED
 * CLOSED ALL ENDPOINTS
 *
 *
 *
 *
 *
 *
 *
 *
 */
const putBills = (request, response) => {
  logging.log({
    level: "info",
    message: "put_bill"
  });
  var put_bill_start = new Date();
  bill_put = bill_put + 1;
  client.count("bill_put_start", bill_put);
  const vendor = request.body.vendor;
  const bill_date = request.body.bill_date;
  const due_date = request.body.due_date;
  const amount_due = request.body.amount_due;
  const categories = request.body.categories;
  const paymentStatus = request.body.paymentStatus;
  var auth = request.headers["authorization"];
  if (auth) {
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
        if (err) {
          logging.log({
            level: "error",
            message: err
          });
        } else if (results.rowCount) {
          if (
            email_address == results.rows[0].email_address &&
            bcrypt.hashSync(password, results.rows[0].password) ==
              results.rows[0].password
          ) {
            const id = request.params.id;
            const hash = bcrypt.hashSync(password, salt);
            if (schema.validate(password)) {
              var update_start_date = new Date();
              pool.query(
                "UPDATE bills SET vendor = $1,bill_date =$2, due_date=$3, amount_due=$4, categories=$5, paymentStatus=$6 WHERE id = $7",
                [
                  vendor,
                  bill_date,
                  due_date,
                  amount_due,
                  categories,
                  paymentStatus,
                  id
                ],
                (error, results) => {
                  if (error) {
                    logging.log({
                      level: "error",
                      message: error
                    });
                    response.status(404).json({ message: "Provide proper ID" });
                  } else {
                    pool.query(
                      "SELECT * FROM bills WHERE id=$1",
                      [id],
                      (error, resu) => {
                        if (error) {
                          logging.log({
                            level: "error",
                            message: error
                          });
                        } else if (resu.rowCount == 1) {
                          var update_end_date = new Date();
                          var update_bill_database =
                            update_end_date.getMilliseconds() -
                            update_start_date.getMilliseconds();
                          client.timing("update_timings", update_bill_database);
                          const resu_json = resu.rows;
                          response.status(200).json(resu_json);
                        } else {
                          response.status(404).json({
                            message: "File not found"
                          });
                        }
                      }
                    );
                  }
                }
              ); //pool.query 3
            } else {
              response.status(400).json({
                message: "Bad Request: password weak"
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
  var bill_put_end = new Date();
  var put_billl =
    bill_put_end.getMilliseconds() - put_bill_start.getMilliseconds();
  client.timing("timing_user(ms)_request_put", put_billl);
};

/*
 * DELETE METHOD
 * AUTHENTICATED
 * VALIDATED
 * CLOSED ALL ENDPOINTS
 *
 *
 *
 *
 *
 *
 *
 *
 */
const deleteBills = (request, response) => {
  logging.log({
    level: "info",
    message: "delete_bill"
  });
  var delete_bill_start = new Date();
  bill_delete = bill_delete + 1;
  client.count("bill_delete_start", bill_delete);
  var auth = request.headers["authorization"];
  const id = request.params.id;
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
            pool.query(
              "SELECT email_address, password FROM users where email_address = $1",
              [email_address],
              (err, results) => {
                if (err) {
                  logging.log({
                    level: "error",
                    message: err
                  });
                } else if (
                  email_address == results.rows[0].email_address &&
                  bcrypt.hashSync(password, results.rows[0].password) ==
                    results.rows[0].password
                ) {
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
                        pool.query(
                          "SELECT * FROM bills WHERE id = $1",
                          [id],
                          (error, results) => {
                            if (results.rowCount == 0) {
                              logging.log({
                                level: "error",
                                message: error
                              });
                              response
                                .status(400)
                                .json({
                                  message: "Bad request: bill deleted already"
                                });
                            } else if (results.rowCount == 1) {
                              const bill_id = results.rows[0].owner_id;
                              if (bill_id == res.rows[0].id) {
                                pool.query(
                                  "SELECT attachment FROM bills WHERE id=$1",
                                  [id],
                                  (error, results) => {
                                    if (error) {
                                      logging.log({
                                        level: "error",
                                        message: error
                                      });
                                    } else if (results.rowCount == null) {
                                      var delete_start_date = new Date();
                                      pool.query(
                                        "DELETE FROM bills WHERE id=$1",
                                        [id],
                                        (error, results) => {
                                          if (error) {
                                            logging.log({
                                              level: "error",
                                              message: error
                                            });
                                          } else {
                                            pool.query(
                                              "SELECT * FROM file_meta WHERE file_bill_id = $1",
                                              [id],
                                              (error, results) => {
                                                const fid =
                                                  results.rows[0].fileid;
                                                if (error) {
                                                  logging.log({
                                                    level: "error",
                                                    message: error
                                                  });
                                                } else if (
                                                  results.rowCount == 1
                                                ) {
                                                  const file_image_key =
                                                    results.rows[0].file_name;
                                                  const params = {
                                                    Bucket:
                                                      process.env.S3_BUCKET_APP,
                                                    Key: file_image_key
                                                  };
                                                  // Deleting from s3 bucket
                                                  s3.deleteObject(
                                                    params,
                                                    (err, data) => {
                                                      if (error) {
                                                        logging.log({
                                                          level: "error",
                                                          message: error
                                                        });
                                                      } else {
                                                        response
                                                          .status(204)
                                                          .json({
                                                            message:
                                                              "S3 deleted"
                                                          });
                                                        pool.query(
                                                          "SELECT * FROM bills WHERE id = $1",
                                                          [id],
                                                          (error, results) => {
                                                            if (error) {
                                                              logging.log({
                                                                level: "error",
                                                                message: error
                                                              });
                                                            } else if (
                                                              results.rowCount ==
                                                              0
                                                            ) {
                                                              pool.query(
                                                                "DELETE FROM file_meta WHERE file_bill_id =$1",
                                                                [id],
                                                                (
                                                                  error,
                                                                  results
                                                                ) => {
                                                                  if (error) {
                                                                    logging.log(
                                                                      {
                                                                        level:
                                                                          "error",
                                                                        message: error
                                                                      }
                                                                    );
                                                                  } else {
                                                                    pool.query(
                                                                      "SELECT * FROM file_meta WHERE file_bill_id = $1",
                                                                      [id],
                                                                      (
                                                                        error,
                                                                        resu
                                                                      ) => {
                                                                        if (
                                                                          error
                                                                        ) {
                                                                          logging.log(
                                                                            {
                                                                              level:
                                                                                "error",
                                                                              message: error
                                                                            }
                                                                          );
                                                                        } else if (
                                                                          resu.rowCount ==
                                                                          0
                                                                        ) {
                                                                          pool.query(
                                                                            "DELETE FROM files WHERE id =$1",
                                                                            [
                                                                              fid
                                                                            ],
                                                                            (
                                                                              error,
                                                                              resu
                                                                            ) => {
                                                                              if (
                                                                                error
                                                                              ) {
                                                                                logging.log(
                                                                                  {
                                                                                    level:
                                                                                      "error",
                                                                                    message: error
                                                                                  }
                                                                                );
                                                                                res
                                                                                  .status(
                                                                                    401
                                                                                  )
                                                                                  .json(
                                                                                    {
                                                                                      message:
                                                                                        "Bad request: cannot delete"
                                                                                    }
                                                                                  );
                                                                              } else {
                                                                                var delete_end_date = new Date();
                                                                                var delete_bill_database =
                                                                                  delete_end_date.getMilliseconds() -
                                                                                  delete_start_date.getMilliseconds();
                                                                                client.timing(
                                                                                  "delete_timings",
                                                                                  delete_bill_database
                                                                                );
                                                                                response
                                                                                  .status(
                                                                                    204
                                                                                  )
                                                                                  .json(
                                                                                    {
                                                                                      message:
                                                                                        "No Content"
                                                                                    }
                                                                                  );
                                                                              }
                                                                            }
                                                                          );
                                                                        } else {
                                                                          res
                                                                            .status(
                                                                              400
                                                                            )
                                                                            .json(
                                                                              {
                                                                                message:
                                                                                  "Bad request:Image metadata Not deleted"
                                                                              }
                                                                            );
                                                                        }
                                                                      }
                                                                    );
                                                                  }
                                                                }
                                                              );
                                                            } else {
                                                              res
                                                                .status(404)
                                                                .json({
                                                                  message:
                                                                    "Bad request:Bill Not deleted"
                                                                });
                                                            }
                                                          }
                                                        );
                                                      }
                                                    }
                                                  );
                                                } else {
                                                  res
                                                    .status(401)
                                                    .json({
                                                      message:
                                                        "Bad request: file not found"
                                                    });
                                                }
                                              }
                                            );
                                          }
                                        }
                                      );
                                    } else if (results.rowCount != null) {
                                      var delete_start_date = new Date();
                                      pool.query(
                                        "DELETE FROM bills WHERE id=$1",
                                        [id],
                                        (error, results) => {
                                          if (error) {
                                            response.status(404).json({
                                              message:
                                                "Data not found try with different ID "
                                            });
                                            response
                                              .status(404)
                                              .json({
                                                message: "Already deleted"
                                              });
                                          } else {
                                            var delete_end_date = new Date();
                                            var delete_bill_database =
                                              delete_end_date.getMilliseconds() -
                                              delete_start_date.getMilliseconds();
                                            client.timing(
                                              "delete_timings",
                                              delete_bill_database
                                            );
                                            response
                                              .status(204)
                                              .json({ message: "No Content" });
                                          }
                                        }
                                      );
                                    } else {
                                      response.status(404).json({
                                        message:
                                          "Bad Request: error with deleting"
                                      });
                                    }
                                  }
                                );
                              } else {
                                response.status(400).json({
                                  message: "User cannot access other records"
                                });
                              }
                            } else {
                              response
                                .status(404)
                                .json({
                                  message: "Bad request: bill already deleted"
                                });
                            }
                          }
                        );
                      } else {
                        res
                          .status(404)
                          .json({ message: "Bad request: uer not found" });
                      }
                    }
                  );
                  // }
                  // });
                }
              }
            );
          } else {
            response.status(400).json({
              message: "Bad Request:email or password does not match"
            });
          }
        } else {
          response.status(400).json({ message: "Bad Request: Password wrong" });
        }
      }
    );
  } else {
    response
      .status(404)
      .json({ message: "Bad Request: please provide more information" });
  }
  var bill_delete_end = new Date();
  var delete_bill =
    bill_delete_end.getMilliseconds() - delete_bill_start.getMilliseconds();
  client.timing("timing_bill(ms)_request_delete", delete_bill);
};

const getBillsV2 = (request, response) => {
  logging.log({
    level: "info",
    message: "get_bill_V2"
  });
  var get_bill_v2_start = new Date();
  bill_get_v2 = bill_get_v2 + 1;
  client.count("bill_v2_count", bill_get_v2);
  pool.query(
    "SELECT * FROM bills ORDER BY created_ts DESC",
    (error, results) => {
      var select_bill_v2_select_start = new Date();
      if (error) {
        logger.log({
          level: "error",
          message: error
        });
      } else if (results.rowCount) {
        var get_bill_v2_select_end = new Date();
        var get_bill_v2_database =
          get_bill_v2_select_end.getMilliseconds() -
          select_bill_v2_select_start.getMilliseconds();
        client.timing("get_user_timings", get_bill_v2_database);
        response.status(200).send(results.rows);
      } else {
        response.status(404).json({ message: "Bills Not Found" });
      }
    }
  );
  var get_bill_v2_end = new Date();
  var get_bill_V22 =
    get_bill_v2_end.getMilliseconds() - get_bill_v2_start.getMilliseconds();
  client.timing("end_of_get_request", get_bill_V22);
};

module.exports = {
  getBills,
  putBills,
  deleteBills,
  addBills,
  getAllBills,
  getBillsV2
};
/*
END
OF
THE
CODE
*/
