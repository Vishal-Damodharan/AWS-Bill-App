#!/bin/bash

if [ "$#" -ne 8 ]; then
    echo "Invalid number of parameters"
    echo Usage: bash create-networkin-stack.sh \<aws_region\> \<vpc_cidr\> \<subnet1\> \<subnet2\> \<subnet3\> \<stack_name\> \<profile\> \<jsonyml\>
    exit 1
fi

StackName=$6
jsonyml=$8
#AWS_REGION verification
AWS_REGION=$1


if [[ "$7" = "dev" ]] ; then
        AWS_Profile="dev"
elif [[ "$7" = "prod" ]] ; then
        AWS_Profile="prod"
else
    echo Creation of VPC Failed.. Use region us-east-1 or us-east-2
    exit 1
fi

export AWS_PROFILE=$AWS_Profile



VpcCIDR=$2

if [ -z "$VpcCIDR" ]; then
  echo Subnet Block cannot be blank...existing

  exit 1
fi

if [[ $VpcCIDR =~ ^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(3[0-2]|[0-2][0-9]|[0-9])$ ]] ; then
     echo CIDR block: $VpcCIDR
  else
	  echo Enter Valid CIDR Block
	  exit 1
  fi

ZONE1="${AWS_REGION}a"
ZONE2="${AWS_REGION}b"
ZONE3="${AWS_REGION}c"


Subnet1=$3

if [ -z "$Subnet1" ]; then
  echo Subnet Block cannot be blank...existing

  exit 1
fi

if [[ $Subnet1 =~ ^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(3[0-2]|[0-2][0-9]|[0-9])$ ]] ; then
     echo Subnet 1: $Subnet1
  else
	  echo Enter Valid CIDR Block
	  exit 1
fi



Subnet2=$4
if [ -z "$Subnet2" ]; then
  echo Subnet Block cannot be blank...existing

  exit 1
fi

if [[ $Subnet2 =~ ^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(3[0-2]|[0-2][0-9]|[0-9])$ ]] ; then
     echo Subnet 2: $Subnet2
  else
	  echo Enter Valid CIDR Block
	  exit 1
fi


Subnet3=$5

if [ -z "$Subnet3" ]; then
  echo Subnet Block cannot be blank...existing

  exit 1
fi

if [[ $Subnet3 =~ ^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/(3[0-2]|[0-2][0-9]|[0-9])$ ]] ; then
     echo Subnet 3: $Subnet3
  else
	  echo Enter Valid CIDR Block
	  exit 1
fi


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
build=$(aws cloudformation create-stack --stack-name $StackName --region $AWS_REGION --template-body file://cf-networking-setup.$jsonyml --parameters ParameterKey=VpcCIDR,ParameterValue=$VpcCIDR ParameterKey=Subnet1,ParameterValue=$Subnet1 ParameterKey=Subnet2,ParameterValue=$Subnet2 ParameterKey=Subnet3,ParameterValue=$Subnet3 "ParameterKey"="AvailabilityZoneA","ParameterValue"=$ZONE1 "ParameterKey"="AvailabilityZoneB","ParameterValue"=$ZONE2 "ParameterKey"="AvailabilityZoneC","ParameterValue"=$ZONE3 "ParameterKey"="IpAddr","ParameterValue"="0.0.0.0/0" --capabilities CAPABILITY_IAM --capabilities CAPABILITY_NAMED_IAM)

# Waiting for stack completion
echo Stack in progress..
wait=$(aws cloudformation wait stack-create-complete --stack-name $StackName --region $AWS_REGION 2>&1)

if [ $? -eq 0 ]; then
  echo "Stack $StackName creation successful!!"
else
  echo "Stack $StackName creation failed..."
  exit 1
fi