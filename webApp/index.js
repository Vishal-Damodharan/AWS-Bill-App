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

var Client = require("node-statsd-client").Client;
var client = new Client("localhost", 8125);
var image_post = 0;
var image_get = 0;
var image_delete = 0;

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
const fs = require('fs')
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  ssl: 
    { 
      rejectUnauthorized: true,
      ca : fs.readFileSync('rds-ca-2019-root.pem')
    }
});

pool.connect((err, client, release) => {
  if (err) {
    logging.log({
      level: "error",
      message: "Database connection failed!!"
    });
  } else {
    logging.log({
      level: "info",
      message: "Database connected to RDS"
    });
  }
});

const createTableText = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TYPE paystat AS ENUM ('paid', 'due', 'past_due', 'no_payment_required');
CREATE TABLE IF NOT EXISTS users (
   id uuid DEFAULT uuid_generate_v4 () PRIMARY KEY,
   first_name VARCHAR (50) NOT NULL,
   last_name VARCHAR (50) NOT NULL,
   password VARCHAR (65) NOT NULL,
   email_address VARCHAR (355) UNIQUE NOT NULL,
   account_created TIMESTAMP NOT NULL,
   account_updated TIMESTAMP
);
CREATE TABLE IF NOT EXISTS bills (
  ID uuid DEFAULT uuid_generate_v4 () PRIMARY KEY,
  created_ts timestamp NOT NULL,
  updated_ts timestamp NOT NULL, 
  owner_id uuid DEFAULT uuid_generate_v4 () NOT NULL, 
  vendor VARCHAR(100) NOT NULL UNIQUE, 
  bill_date Date NOT NULL, 
  due_date Date NOT NULL, 
  amount_due FLOAT8 NOT NULL,
  categories TEXT[4],
  paymentStatus paystat,
  attachment json
);
CREATE TABLE IF NOT EXISTS files(
  file_name VARCHAR(100) NOT NULL, 
  id uuid DEFAULT uuid_generate_v4 () PRIMARY KEY, 
  url VARCHAR(200) NOT NULL, 
  upload_date Date NOT NULL
);
CREATE TABLE IF NOT EXISTS file_meta (
  fileid uuid DEFAULT uuid_generate_v4 () PRIMARY KEY,
  file_name VARCHAR(100),
  file_size integer,
  upload_date Date,
  file_owner_id uuid,
  file_bill_id uuid,
  url VARCHAR(200),
  originalname VARCHAR(100),
  mimetype VARCHAR(100),
  encoding VARCHAR(100),
  fieldname VARCHAR(100),
  path VARCHAR(100),
  md5hash VARCHAR(100),
  bucket VARCHAR(100)
);
`;
pool.query(createTableText, (error, results) => {
  if (error) {
    logging.log({
      level: "error",
      message: "Database tables already exists!!"
    });
  }
});

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);
app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms")
);

// app.get("/", (request, response) => {
//   response.json({ info: "Node.js, Express, and Postgres API" });
// });
const due_query = require("./Due_queries"); // Importing queries.js

app.post("/v1/user", query.createUser); // POST user route
app.get("/v1/user/self", query.getoneUser); // GET user route
app.put("/v1/user/self", query.putUser); // PUT user route

// Bill routes
app.post("/v1/bill/", billquery.addBills); // POST bill route
app.get("/v1/bill/:id", billquery.getBills); // GET bill route
app.get("/v1/bills", billquery.getAllBills); // GET all bills route
app.get("/v1/bills/due/:x", due_query.due_bill); // GET all bills route

app.get("/v3/bills", billquery.getBillsV2); // GET all bills route
app.put("/v1/bill/:id", billquery.putBills); // PUT bills
app.delete("/v1/bill/:id", billquery.deleteBills); // DELETE Bills
app.get('/health', (req, res) => res.status(200).json({ message: 'health successful' }))
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
// define multer storage configuration

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

//single file upload api
app.post("/v1/bill/:id/file", upload.single("billImage"), (req, res, next) => {
  logging.log({
    level: "info",
    message: "post_image"
  });
  var post_start_time = new Date();
  image_post = image_post + 1;
  client.count("count_image_request_post", image_post);

  var auth = req.headers["authorization"];
  var bill_id = req.params.id;

  if (!auth) {
    res.statusCode = 401;
    res.setHeader("WWW-Authenticate", 'Basic realm="Secure Area"');

    res.status(401).json({ message: "Bad request: Unauthorized" });
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
                  var user_id = results.rows[0].id;

                  if (error) {
                    logging.log({
                      level: "error",
                      message: error
                    });
                  } else if (results.rowCount) {
                    pool.query(
                      "SELECT * FROM bills WHERE id = $1",
                      [bill_id],
                      (error, results) => {
                        if (error) {
                          logging.log({
                            level: "error",
                            message: error
                          });
                        } else if (results.rowCount == 0) {
                          res.status(400).json({
                            message: "Bad request: No bills found to attach"
                          });
                        } else {
                          var bid = results.rows[0].owner_id;
                          if (error) {
                            res
                              .status(400)
                              .json({ message: "Bad request: Bill not found" });
                          } else {
                            if (bid == user_id) {
                              const file = req.file;
                              if (!file) {
                                res.status(400).json({
                                  status: "failed",
                                  code: "400",
                                  message: "Please upload correct file"
                                });
                              } else {
                                pool.query(
                                  "SELECT * FROM file_meta WHERE file_bill_id = $1",
                                  [bill_id],
                                  (error, results) => {
                                    if (error) {
                                      logging.log({
                                        level: "error",
                                        message: error
                                      });
                                    } else if (results.rowCount == 1) {
                                      res.status(400).json({
                                        message:
                                          "Bad Request: Bill already has an attachment"
                                      });
                                    } else if (results.rowCount == 0) {
                                      const created_ts = new Date()
                                        .toISOString()
                                        .replace(/T/, " ")
                                        .replace(/\..+/, "");
                                      const name = file.key;
                                      const url = file.location;
                                      const size = file.size;
                                      const gh = file.originalname;
                                      const type = file.mimetype;
                                      const hash = file.contentType;
                                      const fieldname = file.fieldname;
                                      const path = file.storageClass;
                                      const md5hash = req.file.etag;
                                      const bucket = req.file.bucket;
                                      pool.query(
                                        "SELECT * FROM bills WHERE id = $1",
                                        [bill_id],
                                        (error, results) => {
                                          if (error) {
                                            logging.log({
                                              level: "error",
                                              message: error
                                            });
                                          } else if (results.rowCount == 1) {
                                            var insert_start_time = new Date();
                                            pool.query(
                                              "INSERT INTO file_meta (file_name, file_size,upload_date, file_owner_id,file_bill_id, url, originalname, mimetype, encoding,fieldname, path, md5hash,bucket) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
                                              [
                                                name,
                                                size,
                                                created_ts,
                                                user_id,
                                                bill_id,
                                                url,
                                                gh,
                                                type,
                                                hash,
                                                fieldname,
                                                path,
                                                md5hash,
                                                bucket
                                              ],
                                              (error, results) => {
                                                if (error) {
                                                  logging.log({
                                                    level: "error",
                                                    message: error
                                                  });
                                                  res.status(400).json({
                                                    message:
                                                      "Bad Request: cannot insert"
                                                  });
                                                } else {
                                                  var insert_end_time = new Date();
                                                  var image_insert =
                                                    insert_end_time.getMilliseconds() -
                                                    insert_start_time.getMilliseconds();
                                                  client.timing(
                                                    "Insert_image_timings",
                                                    image_insert
                                                  );
                                                  pool.query(
                                                    "SELECT * FROM file_meta WHERE file_bill_id =$1",
                                                    [bill_id],
                                                    (error, results) => {
                                                      const idfile =
                                                        results.rows[0]
                                                          .file_bill_id;
                                                      const fid =
                                                        results.rows[0].fileid;
                                                      const fname =
                                                        results.rows[0]
                                                          .file_name;
                                                      const furl =
                                                        results.rows[0].url;
                                                      if (bill_id == idfile) {
                                                        if (error) {
                                                          logging.log({
                                                            level: "error",
                                                            message: error
                                                          });
                                                        } else {
                                                          pool.query(
                                                            "INSERT INTO files (id, file_name, url, upload_date) VALUES ($1, $2, $3,$4)",
                                                            [
                                                              fid,
                                                              fname,
                                                              furl,
                                                              created_ts
                                                            ],
                                                            (
                                                              error,
                                                              results
                                                            ) => {
                                                              if (error) {
                                                                res
                                                                  .status(400)
                                                                  .json({
                                                                    message:
                                                                      "Bad Request: cannot attach "
                                                                  });
                                                              } else {
                                                                pool.query(
                                                                  "SELECT * FROM files WHERE id= $1 ",
                                                                  [fid],
                                                                  (
                                                                    error,
                                                                    results
                                                                  ) => {
                                                                    const filedata =
                                                                      results
                                                                        .rows[0];
                                                                    if (error) {
                                                                      logging.log(
                                                                        {
                                                                          level:
                                                                            "error",
                                                                          message: error
                                                                        }
                                                                      );
                                                                      res
                                                                        .status(
                                                                          404
                                                                        )
                                                                        .json({
                                                                          message:
                                                                            "File not found"
                                                                        });
                                                                    } else {
                                                                      pool.query(
                                                                        "UPDATE bills SET attachment = $1 WHERE id = $2",
                                                                        [
                                                                          filedata,
                                                                          bill_id
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
                                                                                    "Bad request : cannot update bills"
                                                                                }
                                                                              );
                                                                          } else {
                                                                            res
                                                                              .status(
                                                                                201
                                                                              )
                                                                              .json(
                                                                                filedata
                                                                              );
                                                                          }
                                                                        }
                                                                      );
                                                                    }
                                                                  }
                                                                );
                                                              }
                                                            }
                                                          );
                                                        }
                                                      } else {
                                                        res.status(404).json({
                                                          message:
                                                            "Bad Request: Cannot access another bills attachment"
                                                        });
                                                      }
                                                    }
                                                  );
                                                }
                                              }
                                            );
                                          } else {
                                            res.status(400).json({
                                              message:
                                                "Bad request: No bills found to attach"
                                            });
                                          }
                                        }
                                      );
                                    } else {
                                      res.status(404).json({
                                        message:
                                          "Bad Request: Cannot access another bills attachment"
                                      });
                                    }
                                  }
                                );
                              }
                            } else {
                              res.status(400).json({
                                message:
                                  "Bad Request: User cannot access this bill"
                              });
                            }
                          }
                        }
                      }
                    );
                  } else {
                    res.status(404).json({ message: "File not found" });
                  }
                }
              );
            } else {
              res.status(400).json({
                message: "Bad Request: Email address and password doesn't match"
              });
            }
          } else {
            res.status(400).json({ message: "Bad Request: worng password" });
          }
        } else {
          res.status(400).json({ message: "Bad Request: No user avilable" });
        }
      }
    );
  } else {
    res.status(400).json({ message: "Bad Request: No authentication" });
  }
  var image_post_end = new Date();
  var post_images =
    image_post_end.getMilliseconds() - post_start_time.getMilliseconds();
  client.timing("timing_image_post", post_images);
});

app.get("/v1/bill/:billid/file/:file_id", (req, res, next) => {
  logging.log({
    level: "info",
    message: "get_image"
  });
  var get_image_start = new Date();
  image_get = image_get + 1;
  client.count("image_get_count", image_get);

  var auth = req.headers["authorization"];
  var bill_id = req.params.billid;
  var file_id = req.params.file_id;

  if (!auth) {
    res.statusCode = 401;
    res.setHeader("WWW-Authenticate", 'Basic realm="Secure Area"');

    res.status(401).json({ message: "Bad request: Unauthorized" });
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
                  var user_id = results.rows[0].id;

                  if (error) {
                    logging.log({
                      level: "error",
                      message: error
                    });
                    res.status(404).json({ message: "File not found" });
                  } else {
                    pool.query(
                      "SELECT * FROM bills WHERE owner_id = $1",
                      [user_id],
                      (error, results) => {
                        var bid = results.rows[0].owner_id;

                        if (error) {
                          logging.log({
                            level: "error",
                            message: error
                          });
                          res.status(404).json({ message: "File not found" });
                        } else {
                          if (bid == user_id) {
                            const created_ts = new Date()
                              .toISOString()
                              .replace(/T/, " ")
                              .replace(/\..+/, "");
                            pool.query(
                              "SELECT * FROM file_meta WHERE file_bill_id = $1",
                              [bill_id],
                              (error, results) => {
                                if (error) {
                                  logging.log({
                                    level: "error",
                                    message: error
                                  });
                                } else if (results.rowCount == 1) {
                                  var select_image_start = new Date();
                                  pool.query(
                                    "SELECT * FROM files WHERE id = $1",
                                    [file_id],
                                    (error, resu) => {
                                      if (error) {
                                        logging.log({
                                          level: "error",
                                          message: error
                                        });
                                      } else if (resu.rowCount == 1) {
                                        if (
                                          bill_id ==
                                          results.rows[0].file_bill_id
                                        ) {
                                          pool.query(
                                            "SELECT * FROM files WHERE id = $1",
                                            [file_id],
                                            (error, results) => {
                                              if (error) {
                                                logging.log({
                                                  level: "error",
                                                  message: error
                                                });
                                                res.status(404).json({
                                                  message: "File not found"
                                                });
                                              } else {
                                                var select_image_end = new Date();
                                                var select_image_database =
                                                  select_image_end.getMilliseconds() -
                                                  select_image_start.getMilliseconds();
                                                client.timing(
                                                  "get_user_timings",
                                                  select_image_database
                                                );
                                                var result_json =
                                                  results.rows[0];
                                                res
                                                  .status(200)
                                                  .json(result_json);
                                              }
                                            }
                                          );
                                        } else {
                                          res.status(404).json({
                                            message:
                                              "Bad Request: No access to other attachments"
                                          });
                                        }
                                      } else {
                                        res.status(404).json({
                                          message: "Bad Request: file not found"
                                        });
                                      }
                                    }
                                  );
                                } else {
                                  res.status(404).json({
                                    message: "bad Request: No bill data found"
                                  });
                                }
                              }
                            );
                          } else {
                            res.status(400).json({
                              message:
                                "Bad Request:  user cannot access other bills"
                            });
                          }
                        }
                      }
                    );
                  }
                }
              );
            } else {
              res.status(400).json({
                message: "Bad Request: Email address and password doesn't match"
              });
            }
          } else {
            res.status(400).json({ message: "Bad Request: worng password" });
          }
        } else {
          res.status(400).json({ message: "Bad Request: No user avilable" });
        }
      }
    );
  } else {
    res.status(401).json({ message: "Bad Request: No authentication" });
  }
  var get_image_end = new Date();
  var get_images =
    get_image_end.getMilliseconds() - get_image_start.getMilliseconds();
  client.timing("end_of_get_request", get_images);
});

app.delete("/v1/bill/:billid/file/:file_id", (req, res, next) => {
  logging.log({
    level: "info",
    message: "delete_image"
  });
  var delete_image_start = new Date();
  image_delete = image_delete + 1;
  client.count("image_delete_start", image_delete);
  var auth = req.headers["authorization"];
  var bill_id = req.params.billid;
  var file_id = req.params.file_id;

  if (!auth) {
    res.statusCode = 401;
    res.setHeader("WWW-Authenticate", 'Basic realm="Secure Area"');
    res.status(401).json({ message: "Bad request: Unauthorized" });
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
                  var user_id = results.rows[0].id;

                  if (error) {
                    logging.log({
                      level: "error",
                      message: error
                    });
                    res.status(404).json({ message: "File not found" });
                  } else {
                    pool.query(
                      "SELECT * FROM bills WHERE owner_id = $1",
                      [user_id],
                      (error, results) => {
                        if (error) {
                          logging.log({
                            level: "error",
                            message: error
                          });
                        } else if (results.rowCount == 0) {
                          res.status(404).json({ message: "File not found" });
                        } else {
                          var bid = results.rows[0].owner_id;
                          if (bid == user_id) {
                            const created_ts = new Date()
                              .toISOString()
                              .replace(/T/, " ")
                              .replace(/\..+/, "");
                            pool.query(
                              "SELECT * FROM file_meta WHERE file_bill_id = $1",
                              [bill_id],
                              (error, results) => {
                                if (error) {
                                  logging.log({
                                    level: "error",
                                    message: error
                                  });
                                } else if (results.rowCount == 1) {
                                  if (bill_id == results.rows[0].file_bill_id) {
                                    const file_image_key =
                                      results.rows[0].file_name;
                                    const params = {
                                      Bucket: process.env.S3_BUCKET_APP,
                                      Key: file_image_key
                                    };
                                    // Deleting from s3 bucket
                                    s3.deleteObject(params, (err, data) => {
                                      if (err) {
                                        logger.log({
                                          level: "error",
                                          message: err.stack
                                        });
                                      } else {
                                        var delete_start_date = new Date();
                                        pool.query(
                                          "DELETE FROM files WHERE id = $1",
                                          [file_id],
                                          (error, results) => {
                                            if (error) {
                                              res.status(404).json({
                                                message:
                                                  "Bad Request: Not found already deleted"
                                              });
                                            } else {
                                              pool.query(
                                                "SELECT * FROM files WHERE id = $1",
                                                [file_id],
                                                (error, results) => {
                                                  if (error) {
                                                    logging.log({
                                                      level: "error",
                                                      message: error
                                                    });
                                                  } else if (
                                                    !results.rowCount
                                                  ) {
                                                    pool.query(
                                                      "DELETE FROM file_meta WHERE fileid = $1",
                                                      [file_id],
                                                      (error, results) => {
                                                        if (error) {
                                                          res.status(404).json({
                                                            message:
                                                              "Bad Request: Not fousdnd already deleted"
                                                          });
                                                        } else {
                                                          var delete_end_date = new Date();
                                                          var delete_image_database =
                                                            delete_end_date.getMilliseconds() -
                                                            delete_start_date.getMilliseconds();
                                                          client.timing(
                                                            "delete_timings",
                                                            delete_image_database
                                                          );
                                                          pool.query(
                                                            "SELECT * FROM files WHERE id = $1",
                                                            [file_id],
                                                            (
                                                              error,
                                                              results
                                                            ) => {
                                                              if (error) {
                                                                logging.log({
                                                                  level:
                                                                    "error",
                                                                  message: error
                                                                });
                                                              } else if (
                                                                !results.rowCount
                                                              ) {
                                                                const attach = null;
                                                                pool.query(
                                                                  "UPDATE bills SET attachment = $1 WHERE id = $2",
                                                                  [
                                                                    attach,
                                                                    bill_id
                                                                  ],
                                                                  (
                                                                    error,
                                                                    results
                                                                  ) => {
                                                                    if (error) {
                                                                      res
                                                                        .status(
                                                                          404
                                                                        )
                                                                        .json({
                                                                          message:
                                                                            "Bad Request: Not updated"
                                                                        });
                                                                    } else {
                                                                      res
                                                                        .status(
                                                                          204
                                                                        )
                                                                        .json(
                                                                          "No content"
                                                                        );
                                                                    }
                                                                  }
                                                                );
                                                              } else {
                                                                res
                                                                  .status(404)
                                                                  .json({
                                                                    message:
                                                                      "Bad Request: Not deleted"
                                                                  });
                                                              }
                                                            }
                                                          );
                                                        }
                                                      }
                                                    );
                                                  }
                                                }
                                              );
                                            }
                                          }
                                        );
                                      }
                                    });
                                  } else {
                                    res.status(400).json({
                                      message:
                                        "Bad Request: Cannot access other attachments"
                                    });
                                  }
                                } else {
                                  res
                                    .status(404)
                                    .json({ message: "bad Request: No files" });
                                }
                              }
                            );
                          } else {
                            res.status(400).json({
                              message:
                                "Bad Request: cannot access other user files"
                            });
                          }
                        }
                      }
                    );
                  }
                }
              );
            } else {
              res.status(400).json({
                message: "Bad Request: Email address and password doesn't match"
              });
            }
          } else {
            res.status(400).json({ message: "Bad Request: worng password" });
          }
        } else {
          res.status(404).json({ message: "Bad Request: user not avilable" });
        }
      }
    );
  } else {
    res.status(401).json({ message: "Bad Request: No authentication" });
  }
  var image_delete_end = new Date();
  var delete_image =
    image_delete_end.getMilliseconds() - delete_image_start.getMilliseconds();
  client.timing("timing_image_delete", delete_image);
});

app.listen(port, () => {
  console.log(`App running on port ${port}.`);
});
//END
//OF
//COD
