import { ISecurityGroup, ISubnet, IVpc, Peer, Port, SecurityGroup, Subnet, Vpc } from "@aws-cdk/aws-ec2";
import { App, Stack, StackProps } from "@aws-cdk/core";

export interface VpcResources {
    centralVpc: IVpc
    securityGroup: ISecurityGroup
    subnets: ISubnet[]
}

interface NetworkStackProps extends StackProps {
    stage: string
}

export class NetworkStack extends Stack implements VpcResources {

    readonly centralVpc: IVpc
    readonly securityGroup: ISecurityGroup
    readonly subnets: ISubnet[]

    constructor(scope: App, id: string, props: NetworkStackProps) {
        super(scope, id, props);

        this.centralVpc = Vpc.fromLookup(this, 'central', {
            vpcId: 'vpc-043e5rt6yu3fac',
        })

        this.securityGroup = this.createSecurityGroup(props.stage)

        this.subnets = [
            this.findSubnet(1, 'subnet-0esrdtfyguhjkl', 'c'),
            this.findSubnet(2, 'subnet-0esrdtfyguhjkl', 'd'),
            this.findSubnet(3, 'subnet-0esrdtfyguhjkl', 'c'),
            this.findSubnet(4, 'subnet-0esrdtfyguhjkl', 'd'),
        ]
    }

    private createSecurityGroup(stage: string) {
        const securityGroup = new SecurityGroup(this, `co-neptune-security-group-${stage}`, {
            description: `co-neptune-security-group-${stage}`,
            vpc: this.centralVpc,
            securityGroupName: `co-neptune-security-group-${stage}`,
            allowAllOutbound: true
        })

        securityGroup.addIngressRule(securityGroup, Port.allTcp(), 'all tcp')
        securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(8182), 'gremlin')
        securityGroup.addIngressRule(Peer.anyIpv6(), Port.tcp(8182), 'gremlin')

        return securityGroup
    }

    private findSubnet(number: number, id: string, zone: string): ISubnet {
        return Subnet.fromSubnetAttributes(this, `subnet${number}`, {
            subnetId: id,
            availabilityZone: `us-east-1${zone}`,
        })
    }
}
