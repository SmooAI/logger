import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { ListNodesSummaryResult } from "../models/models_1";
import { ListNodesSummaryRequest } from "../models/models_2";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SSMClientResolvedConfig,
} from "../SSMClient";
export { __MetadataBearer };
export { $Command };
export interface ListNodesSummaryCommandInput extends ListNodesSummaryRequest {}
export interface ListNodesSummaryCommandOutput
  extends ListNodesSummaryResult,
    __MetadataBearer {}
declare const ListNodesSummaryCommand_base: {
  new (
    input: ListNodesSummaryCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListNodesSummaryCommandInput,
    ListNodesSummaryCommandOutput,
    SSMClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    __0_0: ListNodesSummaryCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListNodesSummaryCommandInput,
    ListNodesSummaryCommandOutput,
    SSMClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ListNodesSummaryCommand extends ListNodesSummaryCommand_base {
  protected static __types: {
    api: {
      input: ListNodesSummaryRequest;
      output: ListNodesSummaryResult;
    };
    sdk: {
      input: ListNodesSummaryCommandInput;
      output: ListNodesSummaryCommandOutput;
    };
  };
}
