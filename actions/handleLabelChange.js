const core = require("@actions/core");
const github = require("@actions/github");
const { slackWebClient, getSlackMessageId } = require("../utils");

// TODO handle labels being removed
module.exports = async () => {
  try {
    const channelId = core.getInput("channel-id");
    const labelNameToWatchFor = JSON.parse(core.getInput("labels-for-slack-groups"));
    const slackUsers = JSON.parse(core.getInput("slack-users"));
    const { pull_request, repository, sender } = github.context.payload;

    // if there is now a matching label added, notify the slack message
    // let hasLabel = false;
    // pull_request.labels.forEach((label) => {
    //   if (label.name === labelNameToWatchFor) {
    //     hasLabel = true;
    //   }
    // });

    // atm only one pair of label_name/slack_group is expected to be added in PR since we can't keep track of which one is old and which one is new, otherwise all the labels will be notified every time.

    let groups = [];
    pull_request.labels.forEach((prLabel) => {
      labelNameToWatchFor.forEach((label) => {
        if (prLabel.name === label.label_name) {
          groups.push(label);
        }
      })
    });

    if (groups.length === 0) {
      return null;
    }

    const [labeler] = slackUsers.filter((user) => {
      return user.github_username === sender.login;
    });
    const [author] = slackUsers.filter((user) => {
      return user.github_username === pull_request.user.login;
    });

    let notificationMessage;
    groups.forEach((label) => {
      notificationMessage = notificationMessage + `<@${label.slack_group}>, ${labeler.github_username} added the label ${label.label_name} to the PR\n`;
    });

    // const plainText = `<@${author.slack_id}>, ${labeler.github_username} added the label ${labelNameToWatchFor} to your PR`;
    // const richText = `<@${author.slack_id}>, *${labeler.github_username}* added the label *${labelNameToWatchFor}* to your PR`;
    const slackMessageId = await getSlackMessageId(pull_request, repository);

    await slackWebClient.chat.postMessage({
      channel: channelId,
      thread_ts: slackMessageId,
      text: notificationMessage,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: notificationMessage,
          },
        },
      ],
    });

    return await slackWebClient.reactions.add({
      channel: channelId,
      timestamp: slackMessageId,
      name: "heart_eyes",
    });
  } catch (error) {
    core.setFailed(error.message);
  }
};
