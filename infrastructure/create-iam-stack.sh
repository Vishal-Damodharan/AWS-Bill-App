#!/bin/bash

if [ "$#" -ne 4 ]; then
    echo "Invalid number of parameters"
    echo Usage: bash create-iam-stack.sh \<aws_region\> \<stack_name\> \<profile\> \<jsonyml\>
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
aws_access_key_id=$(aws configure get ${AWS_PROFILE}.aws_access_key_id)
aws_secret_key=$(aws configure get ${AWS_PROFILE}.aws_secret_access_key)
aws_region=$(aws configure get ${AWS_PROFILE}.region)
account_id=$(aws sts get-caller-identity --profile ${AWS_PROFILE} | jq -r '.Account')
S3Bucket=$(aws s3api list-buckets --profile ${AWS_PROFILE}  | jq -r '.Buckets[1].Name')
TagKey="EC2DeployTag"
TagValue="Deploy"

#********************************************************************************************************
#
# CREATE STACK FOR NETWORK AND IAM roles, policies and S3 Buckets
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
build=$(aws cloudformation create-stack --stack-name $StackName --region $AWS_REGION --template-body file://cf-create-iam.$jsonyml --parameters "ParameterKey"="awsregion","ParameterValue"=$AWS_REGION "ParameterKey"="AWSPROFILE","ParameterValue"=$AWS_PROFILE "ParameterKey"="awsaccount","ParameterValue"=$account_id "ParameterKey"="ARNBucketNameObj","ParameterValue"=$ARNBucketNameObj "ParameterKey"="awsaccount","ParameterValue"=$account_id "ParameterKey"="SSEAlgorithm","ParameterValue"=$SSEAlgorithm "ParameterKey"="LifecycleID","ParameterValue"=$LifecycleID "ParameterKey"="LifecycleStatus","ParameterValue"=$LifecycleStatus "ParameterKey"="LifecyclePrefix","ParameterValue"=$LifecyclePrefix "ParameterKey"="LifecycleExpirationInDays","ParameterValue"=$LifecycleExpirationInDays "ParameterKey"="LifecycleTransitionindays","ParameterValue"=$LifecycleTransitionindays "ParameterKey"="LifecycleStorageClass","ParameterValue"=$LifecycleStorageClass "ParameterKey"="ARNBucketName","ParameterValue"=$ARNBucketName --capabilities CAPABILITY_IAM --capabilities CAPABILITY_NAMED_IAM)

# Waiting for stack completion
echo Stack in progress..
wait=$(aws cloudformation wait stack-create-complete --stack-name $StackName --region $AWS_REGION 2>&1)

if [ $? -eq 0 ]; then
  echo "Stack $StackName creation successful!!"
else
  echo "Stack $StackName creation failed..."
  exit 1
fi
