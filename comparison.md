| Aspect | Terraform | CDK | Pulumi |
| ------ | --------- | --- | ------ |
| Maturity (release date) | 2014 | 2018 | 2018 |
| Popularity in Community (stars GitHub) | 24k (AWS module 5.4k) | 4.8k | 6.7k |
| License | CLI is free, TF Cloud can be used for extra integrations | Apache License 2.0 | Free community edition but severe limitations. Team pro is for up to 25 team members, must go Enterprise |
| Multi cloud | ✔️ | ❌ | ✔️ |
| "Hello World" test | ✔️ | ✔️ | ❌ (fails on simple hello world for Go because it couldn't parse ~/.aws/config ) |
| Flexibility (the amount of freedom during coding) | ❌ (hcl is more demanding than general programming languages) | ✔️ (multiple languages available) | ✔️(multiple languages available) |
| Standardization (readability) | ✔️ (easier to read iac code that you didn't write) | ❌ | ❌ |
| State management (how to handle a case when multiple devs + CI do deployment) | ❌ (can be done via S3 or TF cloud) | ✔️ (via CF templates) | ✔️ (via free pulumi's web service) |
| Lookups to existing resources (when we need to re-use a central VPC for example) | ✔️ | ✔️ | ✔️ (it was unclear whether the looked up resource is going to be deleted by destroy command) |
| High-level abstractions | ❌ | ✔️ (L2 constructs) | ✔️ (awsx package, but it does not seem too full) |
| "Not Hello World" test | ❌ | ✔️ (easy to navigate, has l2) | ✔️ (great, occasional minor issues) |
| Stacks (multiple deployments per project) | ✔️ via prefixes/directories or env variables | ✔️ via passed variables to cdk (must be used for all resources) | ❌ via selecting a stack (must be used for all resources), too implicit  |
| Writing | ✔️ (autocomplete works great, but strings when not needed) | ❌ (always unclear when to use l2 or l1, too many modules) | ✔️ (two modules aws vs awsx is confusing but not as much as in CDK)  |
| Verbosity | ❌ (too many keystrokes to describe simple things) | ✔️ | ✔️ |
| Error description | ✔️ | ❌ | ❌ |
| Performance | ✔️ | ❌ (felt slower, due to CF template binding) | ✔️ | 
| Modules | ❌ modules more difficult to pass dependencies than in CDK/Pulumi | ✔️ | ❌ (via stack references, not a first class citizen)  | 
