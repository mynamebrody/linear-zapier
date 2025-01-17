import { ZObject, Bundle } from "zapier-platform-core";
import { getIssueTeamId } from "../fetchFromLinear";

type LabelResponse = {
  id: string;
  name: string;
  parent?: LabelResponse;
};

type LabelsResponse = {
  data: {
    team: {
      labels: {
        nodes: LabelResponse[];
      };
    };
  };
};

const getLabelList = async (z: ZObject, bundle: Bundle) => {
  let teamId = bundle.inputData.teamId || bundle.inputData.team_id;
  if (!teamId && bundle.inputData.issueIdToUpdate) {
    // For the `updateIssue` action, we populate the labels dropdown using the issue's current team if the zap isn't updating the issue's team
    teamId = await getIssueTeamId(z, bundle, bundle.inputData.issueIdToUpdate);
  }
  if (!teamId) {
    throw new z.errors.HaltedError("Please select the team first before selecting the labels");
  }
  const cursor = bundle.meta.page ? await z.cursor.get() : undefined;

  const response = await z.request({
    url: "https://api.linear.app/graphql",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      authorization: bundle.authData.api_key,
    },
    body: {
      query: `
      query ZapierListLabels($teamId: String!, $after: String) {
        team(id: $teamId) {
          labels(first: 50, after: $after) {
            nodes {
              id
              name
              parent {
                id
                name
              }
            }
          }
        }
      }`,
      variables: {
        teamId,
        after: cursor,
      },
    },
    method: "POST",
  });

  const data = (response.json as LabelsResponse).data;
  const labels = data.team.labels.nodes;

  const nextCursor = labels?.[labels.length - 1]?.id;
  if (nextCursor) {
    await z.cursor.set(nextCursor);
  }

  return labels.map((label) => ({
    id: label.id,
    name: label.parent ? `${label.parent.name} → ${label.name}` : label.name,
  }));
};

export const label = {
  key: "label",
  noun: "Label",

  display: {
    label: "Get issue label",
    hidden: true,
    description:
      "The only purpose of this trigger is to populate the dropdown list of issue labels in the UI, thus, it's hidden.",
  },

  operation: {
    perform: getLabelList,
    canPaginate: true,
  },
};
