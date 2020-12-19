#!/bin/bash

if [ "$#" -ne 4 ]; then
    echo "Invalid number of parameters"
    echo Usage: bash create-autoscaling-stack.sh \<aws_region\> \<stack_name\> \<profile\> \<jsonyml\>
    exit 1
fi

StackName=$2
jsonyml=$4
#AWS_REGION verification
AWS_REGION=$1


if [[ "$3" = "dev" ]] ; then
        AWS_Profile="dev"
elif [[ "$3" = "prod" ]] ; then
        AWS_Profile="prod"
else
    echo Creation of VPC Failed.. Use region us-east-1 or us-east-2
    exit 1
fi

export AWS_PROFILE=$AWS_Profile
SSEAlgorithm="AES256"  
StorageClass="STANDARD"
LifecycleID="StandardRule"
LifecycleStatus="Enabled"
LifecyclePrefix="standard"
LifecycleExpirationInDays="35"
LifecycleTransitionindays="30"
LifecycleStorageClass="STANDARD_IA"
ARNBucketName="arn:aws:s3:::"

DeviceName="/dev/sda1"
VolumeType="gp2"
DeleteOnTermination="true"
VolumeSize="30"
InstanceType="t2.micro"
KeyName="ec2cert"

Protocol="tcp"
portdb="5432"
portapp1="22"
portapp2="80" 
portapp3="443"
portapp4="5000"
CidrIp="0.0.0.0/0"
aws_access_key_id=$(aws configure get ${AWS_PROFILE}.aws_access_key_id)
aws_secret_key=$(aws configure get ${AWS_PROFILE}.aws_secret_access_key)
aws_region=$(aws configure get ${AWS_PROFILE}.region)
account_id=$(aws sts get-caller-identity --profile ${AWS_PROFILE} | jq -r '.Account')
ImageId=$(aws ec2 describe-images --owners ${account_id} --region ${AWS_REGION} --query Images[0].ImageId) 
echo $ImageId
endpoint=$(aws rds describe-db-cluster-endpoints)
s3bucket=$(aws s3api list-buckets --query "Buckets[].Name")
TagKey="EC2DeployTag"
TagValue="Deploy"
DBInstanceID="csye62252020"
DBName="csye6225"
DBInstanceClass="db.t3.micro"
DBAllocatedStorage="50"
DBUsername="dbuser"
DBPassword="mdv235316113"

aws_access_key_id=$(aws configure get ${AWS_PROFILE}.aws_access_key_id)
aws_secret_access_key=$(aws configure get ${AWS_PROFILE}.aws_secret_access_key)
aws_region=$(aws configure get ${AWS_PROFILE}.region)
myVPC=$(aws ec2 describe-vpcs --profile $AWS_PROFILE --region $AWS_REGION --filters "Name=isDefault,Values=false" --query Vpcs[0].VpcId | jq -r '.')
Subnet1=$(aws ec2 describe-subnets  --profile $AWS_PROFILE --region $AWS_REGION --filters "Name=vpc-id,Values=$myVPC" | jq -r '.Subnets[2].SubnetId')
Subnet2=$(aws ec2 describe-subnets --profile $AWS_PROFILE --region $AWS_REGION  --filters "Name=vpc-id,Values=$myVPC" | jq -r '.Subnets[1].SubnetId')
Subnet3=$(aws ec2 describe-subnets --profile $AWS_PROFILE --region $AWS_REGION  --filters "Name=vpc-id,Values=$myVPC" | jq -r '.Subnets[0].SubnetId')
S3Bucket=$(aws s3api list-buckets --profile $AWS_PROFILE --region $AWS_REGION | jq -r '.Buckets[1].Name')
echo $S3Bucket
CertificateARN=$(aws acm list-certificates --profile $AWS_PROFILE | jq -r '.CertificateSummaryList[].CertificateArn')
echo $CertificateARN
DomainName=$(aws route53 list-hosted-zones --profile $AWS_PROFILE --max-items 1 | jq -r '.HostedZones[].Name')
ec2instanceprofile=$(aws iam list-instance-profiles --profile $AWS_PROFILE | jq -r '.InstanceProfiles[0].InstanceProfileName')
SNSTopicArn=$(aws sns list-topics --profile $AWS_PROFILE --region $AWS_REGION | jq -r '.Topics[0].TopicArn')
SqsQueueUrl=$(aws sqs list-queues --profile $AWS_PROFILE --region $AWS_REGION | jq -r '.QueueUrls[]')

#********************************************************************************************************
#
# CREATE STACK FOR EC2, RDS , Security groups, CICD
#
#********************************************************************************************************
if name=$(! aws cloudformation describe-stacks --stack-name $StackName 2>&1) ; then
  echo Stack name does not exist, Proceeding ahead...
else
    echo Stack exists, Enter a different name...
    exit 1
fi


#Creation of the Stack

echo Building Stack...
build=$(aws cloudformation create-stack --stack-name $StackName --region $AWS_REGION --template-body file://cf-auto-scaling-stack.$jsonyml --parameters "ParameterKey"="ARNBucketNameObj","ParameterValue"=$ARNBucketNameObj "ParameterKey"="DomainName","ParameterValue"=$DomainName "ParameterKey"="CertificateARN","ParameterValue"=$CertificateARN "ParameterKey"="awsaccount","ParameterValue"=$account_id "ParameterKey"="SSEAlgorithm","ParameterValue"=$SSEAlgorithm "ParameterKey"="LifecycleID","ParameterValue"=$LifecycleID "ParameterKey"="LifecycleStatus","ParameterValue"=$LifecycleStatus "ParameterKey"="LifecyclePrefix","ParameterValue"=$LifecyclePrefix "ParameterKey"="LifecycleExpirationInDays","ParameterValue"=$LifecycleExpirationInDays "ParameterKey"="LifecycleTransitionindays","ParameterValue"=$LifecycleTransitionindays "ParameterKey"="LifecycleStorageClass","ParameterValue"=$LifecycleStorageClass "ParameterKey"="ARNBucketName","ParameterValue"=$ARNBucketName "ParameterKey"="VolumeSize","ParameterValue"=$VolumeSize "ParameterKey"="DeleteOnTermination","ParameterValue"=$DeleteOnTermination "ParameterKey"="VolumeType","ParameterValue"=$VolumeType "ParameterKey"="DeviceName","ParameterValue"=$DeviceName "ParameterKey"="InstanceType","ParameterValue"=$InstanceType "ParameterKey"="ImageId","ParameterValue"=$ImageId "ParameterKey"="KeyName","ParameterValue"=$KeyName "ParameterKey"="portapp1","ParameterValue"=$portapp1 "ParameterKey"="portapp2","ParameterValue"=$portapp2 "ParameterKey"="portapp3","ParameterValue"=$portapp3 "ParameterKey"="portapp4","ParameterValue"=$portapp4 "ParameterKey"="Protocol","ParameterValue"=$Protocol "ParameterKey"="portdb","ParameterValue"=$portdb "ParameterKey"="CidrIp","ParameterValue"=$CidrIp "ParameterKey"="ImageId","ParameterValue"=$ImageId "ParameterKey"="DBUsername","ParameterValue"=$DBUsername "ParameterKey"="DBAllocatedStorage","ParameterValue"=$DBAllocatedStorage "ParameterKey"="DBInstanceClass","ParameterValue"=$DBInstanceClass "ParameterKey"="DBName","ParameterValue"=$DBName "ParameterKey"="DBInstanceID","ParameterValue"=$DBInstanceID "ParameterKey"="DBPassword","ParameterValue"=$DBPassword "ParameterKey"="userdata","ParameterValue"=$(base64 -w0 userdata.sh) "ParameterKey"="awsregion","ParameterValue"=$AWS_REGION "ParameterKey"="awsaccesskeyid","ParameterValue"=$aws_access_key_id "ParameterKey"="awssecretaccesskey","ParameterValue"=$aws_secret_access_key "ParameterKey"="awsaccount","ParameterValue"=$account_id "ParameterKey"="TagKey","ParameterValue"=$Tagkey "ParameterKey"="TagValue","ParameterValue"=$TagValue "ParameterKey"="myVPC","ParameterValue"=$myVPC "ParameterKey"="PublicSubnet1","ParameterValue"=$Subnet1 "ParameterKey"="PublicSubnet2","ParameterValue"=$Subnet2 "ParameterKey"="PublicSubnet3","ParameterValue"=$Subnet3 "ParameterKey"="S3Bucket","ParameterValue"=$S3Bucket "ParameterKey"="ec2instanceprofile","ParameterValue"=$ec2instanceprofile  "ParameterKey"="SNSTopicArn","ParameterValue"=$SNSTopicArn "ParameterKey"="SqsQueueUrl","ParameterValue"=$SqsQueueUrl --capabilities CAPABILITY_IAM --capabilities CAPABILITY_NAMED_IAM)

# Waiting for stack completion
echo Stack in progress..
wait=$(aws cloudformation wait stack-create-complete --stack-name $StackName --region $AWS_REGION 2>&1)

if [ $? -eq 0 ]; then
  echo "Stack $StackName creation successful!!"
else
  echo "Stack $StackName creation failed..."
  exit 1
fi