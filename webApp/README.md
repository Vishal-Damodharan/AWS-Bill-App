# webapp
Author: Vishal Damodharan
NU ID: 001387249
CSYE6225 SPRING 2020

Project:
A restful API worked with Node.js and stored in postgreSQL and pushed to github for integrating with CircleCI.

Use:
This project is to add users to a database, view the user from the database and update that user.
Users can add their own bills to the database.

Workings:
Users can be created and updated by going into these endpoints:
Create User: <Host>:<port>/v1/user
Get User: <Host>:<port>/v1/user/self
Update User: <Host>:<port>/v1/user/self

User can POST, PUT, GET & DELETE Bills in these endpoints
Create a bill:  <Host>:<port>/v1/bill/
get all bills: <Host>:<port>/v1/bills
get a bill: <Host>:<port>/v1/bill/:id
Update a bill: <Host>:<port>/v1/bill/:id
Delete a bill: <Host>:<port>/v1/bill/:id

Images for each bill can created, viewed & deleted in these endpoints
Create a image:  <Host>:<port>/v1/bill/:id/file
get a image: <Host>:<port>/v1/bill/:billid/file/:file_id
Delete a image: <Host>:<port>/v1/bill/:billid/file/:file_id