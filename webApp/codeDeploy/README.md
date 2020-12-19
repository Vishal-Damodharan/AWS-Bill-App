Code Deploy files to install packages, start application, stop application in the ec2 Instance.
Run this Command to deploy updated code
curl -u <CircleCI_User_Token>:      -d build_parameters[CIRCLE_JOB]  https://circleci.com/api/v1.1/project/github/<Account>/<Git-Repo>/tree/<Git-Branch>