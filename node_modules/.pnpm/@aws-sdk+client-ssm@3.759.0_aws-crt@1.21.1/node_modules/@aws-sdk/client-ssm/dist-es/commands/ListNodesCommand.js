import { getEndpointPlugin } from "@smithy/middleware-endpoint";
import { getSerdePlugin } from "@smithy/middleware-serde";
import { Command as $Command } from "@smithy/smithy-client";
import { commonParams } from "../endpoint/EndpointParameters";
import { ListNodesResultFilterSensitiveLog } from "../models/models_1";
import { de_ListNodesCommand, se_ListNodesCommand } from "../protocols/Aws_json1_1";
export { $Command };
export class ListNodesCommand extends $Command
    .classBuilder()
    .ep(commonParams)
    .m(function (Command, cs, config, o) {
    return [
        getSerdePlugin(config, this.serialize, this.deserialize),
        getEndpointPlugin(config, Command.getEndpointParameterInstructions()),
    ];
})
    .s("AmazonSSM", "ListNodes", {})
    .n("SSMClient", "ListNodesCommand")
    .f(void 0, ListNodesResultFilterSensitiveLog)
    .ser(se_ListNodesCommand)
    .de(de_ListNodesCommand)
    .build() {
}
