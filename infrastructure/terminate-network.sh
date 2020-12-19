#!/bin/bash

if [ "$#" -ne 3 ]; then
    echo "Invalid number of parameters"
    echo Usage: bash terminate-network.sh  \<profile\> \<aws_region\> \<vpc_name\>
    exit 1
fi


profile=$1
AWS_Region=$2
VPC_name=$3


if [[ "$profile" = "dev" ]] ; then
        AWS_PROFILE="dev"
   elif [[ "$profile" = "prod" ]] ; then
        AWS_PROFILE="prod"
      else
           echo Parameterizing VPC_ID Failed... Specify profile as dev or prod                                                                                                                          1,1           Top
           exit 1
fi
echo "You are in $profile environment"

export AWS_PROFILE

list_vpc=$(aws ec2 describe-vpcs --query 'Vpcs[*].Tags[*].{Value:Value}' --filters Name=is-default,Values=false --region $AWS_Region --output text 2>&1)

if [[ -z "$list_vpc"  ]]
then
    echo "No VPCs in this region"
        exit 1
fi

VPC_ID=$(aws ec2 describe-vpcs --filters Name=tag:Name,Values=$VPC_name --query 'Vpcs[*].{VpcId:VpcId}' --output text --region $AWS_Region 2>&1)

echo "selected VPC is $VPC_ID"


GATEWAY_ID=$(aws ec2 describe-internet-gateways \
 --query 'InternetGateways[*].{InternetGatewayId:InternetGatewayId}' --filters "Name=attachment.vpc-id,Values=$VPC_ID"  --region $AWS_Region --output text 2>&1)
if [ $? -ne "0" ]
then
        echo "Parameterizing GATEWAY_ID Failed......"
        exit 1
else
        echo "Internet Gateway : $GATEWAY_ID"
fi

ROUTE_ID=$(aws ec2 describe-route-tables \
 --filters Name=vpc-id,Values=$VPC_ID Name=route.gateway-id,Values=$GATEWAY_ID  --query 'RouteTables[*].{RouteTableId:RouteTableId}' \
 --output text   --region $AWS_Region 2>&1)
if [ $? -ne "0" ]
then
        echo "Parameterizing ROUTE_ID Failed......"
        exit 1
else
        echo $ROUTE_ID
fi

#=========================================================================================
#Dissociation of Subnet with Route Table
#=========================================================================================
echo "Dissociation of Subnet with route-table"
aws ec2 describe-route-tables --query 'RouteTables[*].Associations[].{RouteTableAssociationId:RouteTableAssociationId}' --route-table-id $ROUTE_ID --region $AWS_Region --output text|while read associate; do  aws ec2 disassociate-route-table --region $AWS_Region --association-id $associate; done
if [ $? -ne "0" ]
then
        echo "Disassociation of subnets Failed......"
        exit 1
else
        echo "Disassociation of subnets done successfully......"
fi

#=========================================================================================
#Deletion of Subnets
#=========================================================================================
echo "Starting deletion of Subnets..."
while 
sub=$(aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC_ID  --query 'Subnets[*].SubnetId' --region $AWS_Region --output text 2>&1)
[[ ! -z $sub ]]
do
        var1=$(echo $sub | cut -f1 -d" ")
        echo $var1 is deleted 
        aws ec2 delete-subnet --subnet-id $var1 --region $AWS_Region
done

#=========================================================================================
#Deletion of Route 0.0.0.0/0
#=========================================================================================
echo "deleting route 0.0.0.0___"
Con=$(aws ec2 describe-route-tables --filters Name=vpc-id,Values=$VPC_ID --query RouteTables[*].Routes[].{DestinationCidrBlock:DestinationCidrBlock} --region $AWS_Region --output text| grep '0.0.0.0/0' 2>&1)
aws ec2 delete-route --route-table-id $ROUTE_ID --destination-cidr-block $Con --region $AWS_Region
echo "0.0.0.0/0 is deleted successfully"

#=========================================================================================
#Detaching Internet gateway with vpc
#=========================================================================================
echo "detaching internet gateway with vpc"
aws ec2 detach-internet-gateway --internet-gateway-id $GATEWAY_ID --vpc-id $VPC_ID --region $AWS_Region
echo "detaching internet gateway with vpc is done successfully"

#=========================================================================================
#Deletion of Internet gateway
#=========================================================================================
echo "deleting internet gateway"
aws ec2 delete-internet-gateway --internet-gateway-id $GATEWAY_ID --region $AWS_Region
echo "Internet gateway is deleted successfully"

#=========================================================================================
#Deletion of Route table
#=========================================================================================
echo "deleting route table"
aws ec2 delete-route-table --route-table-id $ROUTE_ID --region $AWS_Region
echo "Route table is deleted successfully"

#=========================================================================================
#Deletion of VPC
#=========================================================================================
echo "deleting vpc......"
aws ec2 delete-vpc --vpc-id $VPC_ID --region $AWS_Region
echo "VPC is Deleted successfully"
