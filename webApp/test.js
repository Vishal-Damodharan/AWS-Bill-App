const query = require("./queries");      // Importing queries.js
const Pool = require("pg").Pool; // postgres tabsle pool inport



const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD
  });
  
  pool.connect((err, client, release) => {
    if (err) {
      console.log("Database connection failed!!");
    } else {
      console.log("Database connected successfully to RDS");
    }
  });
  
const users = (res,req)=>{
Pool.query('SELECT * FROM users ', (error, resuts) => {
    if(error){
        console.log("test failed")

    }else{
        console.log("test passd")
        console.log("results.rows")
    }

});
}


