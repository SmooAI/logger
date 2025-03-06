import { Command as $Command } from "@smithy/smithy-client";
import { MetadataBearer as __MetadataBearer } from "@smithy/types";
import { ListNodesRequest, ListNodesResult } from "../models/models_1";
import {
  ServiceInputTypes,
  ServiceOutputTypes,
  SSMClientResolvedConfig,
} from "../SSMClient";
export { __MetadataBearer };
export { $Command };
export interface ListNodesCommandInput extends ListNodesRequest {}
export interface ListNodesCommandOutput
  extends ListNodesResult,
    __MetadataBearer {}
declare const ListNodesCommand_base: {
  new (
    input: ListNodesCommandInput
  ): import("@smithy/smithy-client").CommandImpl<
    ListNodesCommandInput,
    ListNodesCommandOutput,
    SSMClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  new (
    ...[input]: [] | [ListNodesCommandInput]
  ): import("@smithy/smithy-client").CommandImpl<
    ListNodesCommandInput,
    ListNodesCommandOutput,
    SSMClientResolvedConfig,
    ServiceInputTypes,
    ServiceOutputTypes
  >;
  getEndpointParameterInstructions(): import("@smithy/middleware-endpoint").EndpointParameterInstructions;
};
export declare class ListNodesCommand extends ListNodesCommand_base {
  protected static __types: {
    api: {
      input: ListNodesRequest;
      output: ListNodesResult;
    };
    sdk: {
      input: ListNodesCommandInput;
      output: ListNodesCommandOutput;
    };
  };
}
