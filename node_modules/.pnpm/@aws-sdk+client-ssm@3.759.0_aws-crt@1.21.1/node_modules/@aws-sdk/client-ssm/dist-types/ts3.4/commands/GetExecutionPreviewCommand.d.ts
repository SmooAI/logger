import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  GetExecutionPreviewRequest,
  GetExecutionPreviewResponse,
} from "../models/models_1";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SSMClientResolvedConfig,
} from "../SSMClient";
export { __MetadataBearer };
export { $Command };
export interface GetExecutionPreviewCommandInput
  extends GetExecutionPreviewRequest {}
export interface GetExecutionPreviewCommandOutput
  extends GetExecutionPreviewResponse,
    __MetadataBearer {}
declare const GetExecutionPreviewCommand_base: {
  new (
    input: GetExecutionPreviewCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    GetExecutionPreviewCommandInput,
    GetExecutionPreviewCommandOutput,
    SSMClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    __0_0: GetExecutionPreviewCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    GetExecutionPreviewCommandInput,
    GetExecutionPreviewCommandOutput,
    SSMClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class GetExecutionPreviewCommand extends GetExecutionPreviewCommand_base {
  protected static __types: {
    api: {
      input: GetExecutionPreviewRequest;
      output: GetExecutionPreviewResponse;
    };
    sdk: {
      input: GetExecutionPreviewCommandInput;
      output: GetExecutionPreviewCommandOutput;
    };
  };
}
