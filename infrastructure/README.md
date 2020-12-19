# infrastructure
Cloudformation templates to connect to instances/create VPC/ IGW/RT/Subnets from any region and any account in both yaml and json formats.



For Networking VPC, Subnets amd Internet Gateway :
bash create-networkin-stack.sh \<aws_region\> \<vpc_cidr\> \<subnet1\> \<subnet2\> \<subnet3\> \<stack_name\> \<profile\>

For IAM Roles, policies, Instance profiles:
bash create-iam-stack.sh \<aws_region\> \<stack_name\> \<profile\>

For the whole application to run in autoscaling :
bash create-autoscaling-stack.sh \<aws_region\> \<stack_name\> \<profile\>

For bils due lambda to run  :
bash create-lambda-stack.sh \<aws_region\> \<stack_name\> \<profile\> \<Email_address\>

enter the appropriate variables in the command to run the clouformation template in any region 

To terminate stack run this command:
bash terminate-stack.sh \<AWS_REGION\> \<Stack_Name\> \<Stack_Profile\>