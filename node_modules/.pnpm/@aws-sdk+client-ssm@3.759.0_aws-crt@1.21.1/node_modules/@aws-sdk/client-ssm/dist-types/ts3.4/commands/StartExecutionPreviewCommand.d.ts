import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import {
  StartExecutionPreviewRequest,
  StartExecutionPreviewResponse,
} from "../models/models_2";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SSMClientResolvedConfig,
} from "../SSMClient";
export { __MetadataBearer };
export { $Command };
export interface StartExecutionPreviewCommandInput
  extends StartExecutionPreviewRequest {}
export interface StartExecutionPreviewCommandOutput
  extends StartExecutionPreviewResponse,
    __MetadataBearer {}
declare const StartExecutionPreviewCommand_base: {
  new (
    input: StartExecutionPreviewCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    StartExecutionPreviewCommandInput,
    StartExecutionPreviewCommandOutput,
    SSMClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    __0_0: StartExecutionPreviewCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    StartExecutionPreviewCommandInput,
    StartExecutionPreviewCommandOutput,
    SSMClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class StartExecutionPreviewCommand extends StartExecutionPreviewCommand_base {
  protected static __types: {
    api: {
      input: StartExecutionPreviewRequest;
      output: StartExecutionPreviewResponse;
    };
    sdk: {
      input: StartExecutionPreviewCommandInput;
      output: StartExecutionPreviewCommandOutput;
    };
  };
}
