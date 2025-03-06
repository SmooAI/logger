import { Paginator } from "@smithy/types";
import { ListNodesSummaryCommandInput, ListNodesSummaryCommandOutput } from "../commands/ListNodesSummaryCommand";
import { SSMPaginationConfiguration } from "./Interfaces";
/**
 * @public
 */
export declare const paginateListNodesSummary: (config: SSMPaginationConfiguration, input: ListNodesSummaryCommandInput, ...rest: any[]) => Paginator<ListNodesSummaryCommandOutput>;
