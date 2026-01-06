/**
 * Integration Provider Services
 * Implements actual API connections for all supported third-party integrations
 */

export interface Guide {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IntegrationConfig {
  [key: string]: string;
}

export interface IntegrationResult {
  success: boolean;
  message: string;
  externalId?: string;
  error?: string;
}

// Base provider interface
export interface IntegrationProvider {
  name: string;
  validateCredentials(config: IntegrationConfig): Promise<IntegrationResult>;
  sendGuideNotification(guide: Guide, config: IntegrationConfig, action: 'published' | 'updated' | 'deleted'): Promise<IntegrationResult>;
  syncGuide?(guide: Guide, config: IntegrationConfig): Promise<IntegrationResult>;
}

// =============================================================================
// SLACK INTEGRATION
// =============================================================================
class SlackProvider implements IntegrationProvider {
  name = 'slack';

  async validateCredentials(config: IntegrationConfig): Promise<IntegrationResult> {
    const { webhookUrl } = config;
    
    if (!webhookUrl) {
      return { success: false, message: 'Webhook URL is required', error: 'missing_webhook_url' };
    }

    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      return { success: false, message: 'Invalid Slack webhook URL format', error: 'invalid_url_format' };
    }

    try {
      // Send a test message to validate the webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'FlowCapture integration connected successfully!'
        })
      });

      if (response.ok) {
        return { success: true, message: 'Slack webhook validated successfully' };
      } else {
        const errorText = await response.text();
        return { success: false, message: `Slack webhook validation failed: ${errorText}`, error: errorText };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to connect to Slack webhook', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async sendGuideNotification(guide: Guide, config: IntegrationConfig, action: 'published' | 'updated' | 'deleted'): Promise<IntegrationResult> {
    const { webhookUrl, channel } = config;
    
    if (!webhookUrl) {
      return { success: false, message: 'Webhook URL not configured', error: 'missing_webhook_url' };
    }

    const actionText = {
      published: 'New guide published',
      updated: 'Guide updated',
      deleted: 'Guide deleted'
    };

    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: actionText[action],
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${guide.title}*\n${guide.description || 'No description'}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Views: ${guide.viewCount} | Status: ${guide.status}`
            }
          ]
        }
      ]
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return { success: true, message: 'Notification sent to Slack' };
      } else {
        const errorText = await response.text();
        return { success: false, message: `Failed to send Slack notification: ${errorText}`, error: errorText };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to send Slack notification', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// =============================================================================
// MICROSOFT TEAMS INTEGRATION
// =============================================================================
class MicrosoftTeamsProvider implements IntegrationProvider {
  name = 'microsoft_teams';

  async validateCredentials(config: IntegrationConfig): Promise<IntegrationResult> {
    const { webhookUrl } = config;
    
    if (!webhookUrl) {
      return { success: false, message: 'Webhook URL is required', error: 'missing_webhook_url' };
    }

    if (!webhookUrl.includes('webhook.office.com') && !webhookUrl.includes('microsoft.com')) {
      return { success: false, message: 'Invalid Microsoft Teams webhook URL format', error: 'invalid_url_format' };
    }

    try {
      // Send a test message to validate the webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          '@type': 'MessageCard',
          '@context': 'https://schema.org/extensions',
          summary: 'FlowCapture Connected',
          themeColor: '0078D7',
          title: 'FlowCapture Integration',
          text: 'FlowCapture integration connected successfully!'
        })
      });

      if (response.ok) {
        return { success: true, message: 'Microsoft Teams webhook validated successfully' };
      } else {
        const errorText = await response.text();
        return { success: false, message: `Teams webhook validation failed: ${errorText}`, error: errorText };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to connect to Microsoft Teams webhook', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async sendGuideNotification(guide: Guide, config: IntegrationConfig, action: 'published' | 'updated' | 'deleted'): Promise<IntegrationResult> {
    const { webhookUrl } = config;
    
    if (!webhookUrl) {
      return { success: false, message: 'Webhook URL not configured', error: 'missing_webhook_url' };
    }

    const actionText = {
      published: 'New Guide Published',
      updated: 'Guide Updated',
      deleted: 'Guide Deleted'
    };

    const themeColor = {
      published: '00C853',
      updated: 'FF9800',
      deleted: 'F44336'
    };

    const payload = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: `${actionText[action]}: ${guide.title}`,
      themeColor: themeColor[action],
      title: actionText[action],
      sections: [{
        activityTitle: guide.title,
        activitySubtitle: new Date().toISOString(),
        facts: [
          { name: 'Status', value: guide.status },
          { name: 'Views', value: guide.viewCount.toString() }
        ],
        text: guide.description || 'No description provided'
      }]
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return { success: true, message: 'Notification sent to Microsoft Teams' };
      } else {
        const errorText = await response.text();
        return { success: false, message: `Failed to send Teams notification: ${errorText}`, error: errorText };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to send Microsoft Teams notification', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// =============================================================================
// NOTION INTEGRATION
// =============================================================================
class NotionProvider implements IntegrationProvider {
  name = 'notion';

  async validateCredentials(config: IntegrationConfig): Promise<IntegrationResult> {
    const { apiKey, databaseId } = config;
    
    if (!apiKey) {
      return { success: false, message: 'Notion API key is required', error: 'missing_api_key' };
    }

    try {
      // Validate by querying the API
      const response = await fetch('https://api.notion.com/v1/users/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28'
        }
      });

      if (response.ok) {
        return { success: true, message: 'Notion API key validated successfully' };
      } else {
        const error = await response.json();
        return { success: false, message: `Notion validation failed: ${error.message || 'Invalid API key'}`, error: error.code };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to connect to Notion API', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async sendGuideNotification(guide: Guide, config: IntegrationConfig, action: 'published' | 'updated' | 'deleted'): Promise<IntegrationResult> {
    // Notion doesn't have traditional notifications - we sync pages instead
    return this.syncGuide!(guide, config);
  }

  async syncGuide(guide: Guide, config: IntegrationConfig): Promise<IntegrationResult> {
    const { apiKey, databaseId, parentPageId } = config;
    
    if (!apiKey) {
      return { success: false, message: 'Notion API key not configured', error: 'missing_api_key' };
    }

    const parent = databaseId 
      ? { database_id: databaseId }
      : parentPageId 
        ? { page_id: parentPageId }
        : null;

    if (!parent) {
      return { success: false, message: 'Either database ID or parent page ID is required', error: 'missing_parent' };
    }

    const properties = databaseId ? {
      'Name': {
        title: [{ text: { content: guide.title } }]
      },
      'Status': {
        select: { name: guide.status }
      }
    } : {
      title: {
        title: [{ text: { content: guide.title } }]
      }
    };

    try {
      const response = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28'
        },
        body: JSON.stringify({
          parent,
          properties,
          children: [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content: guide.description || 'No description' } }]
              }
            },
            {
              object: 'block',
              type: 'divider',
              divider: {}
            },
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ 
                  type: 'text', 
                  text: { content: `Views: ${guide.viewCount} | Last updated: ${guide.updatedAt.toISOString()}` } 
                }]
              }
            }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, message: 'Guide synced to Notion', externalId: data.id };
      } else {
        const error = await response.json();
        return { success: false, message: `Failed to sync to Notion: ${error.message}`, error: error.code };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to sync guide to Notion', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// =============================================================================
// JIRA INTEGRATION
// =============================================================================
class JiraProvider implements IntegrationProvider {
  name = 'jira';

  async validateCredentials(config: IntegrationConfig): Promise<IntegrationResult> {
    const { domain, email, apiToken } = config;
    
    if (!domain || !email || !apiToken) {
      return { success: false, message: 'Jira domain, email, and API token are required', error: 'missing_credentials' };
    }

    try {
      const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
      const response = await fetch(`https://${domain}/rest/api/3/myself`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        return { success: true, message: 'Jira credentials validated successfully' };
      } else {
        const error = await response.json();
        return { success: false, message: `Jira validation failed: ${error.message || 'Invalid credentials'}`, error: 'auth_failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to connect to Jira', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async sendGuideNotification(guide: Guide, config: IntegrationConfig, action: 'published' | 'updated' | 'deleted'): Promise<IntegrationResult> {
    const { domain, email, apiToken, projectKey, issueType } = config;
    
    if (!domain || !email || !apiToken || !projectKey) {
      return { success: false, message: 'Jira configuration incomplete', error: 'missing_config' };
    }

    if (action === 'deleted') {
      return { success: true, message: 'No Jira action for deleted guides' };
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

    try {
      const response = await fetch(`https://${domain}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            project: { key: projectKey },
            summary: `[FlowCapture] Guide ${action}: ${guide.title}`,
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: guide.description || 'No description provided' }
                  ]
                }
              ]
            },
            issuetype: { name: issueType || 'Task' }
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, message: `Jira issue created: ${data.key}`, externalId: data.key };
      } else {
        const error = await response.json();
        return { success: false, message: `Failed to create Jira issue: ${JSON.stringify(error.errors || error)}`, error: 'create_failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to create Jira issue', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// =============================================================================
// CONFLUENCE INTEGRATION
// =============================================================================
class ConfluenceProvider implements IntegrationProvider {
  name = 'confluence';

  async validateCredentials(config: IntegrationConfig): Promise<IntegrationResult> {
    const { domain, email, apiToken } = config;
    
    if (!domain || !email || !apiToken) {
      return { success: false, message: 'Confluence domain, email, and API token are required', error: 'missing_credentials' };
    }

    try {
      const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
      const response = await fetch(`https://${domain}/wiki/rest/api/user/current`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        return { success: true, message: 'Confluence credentials validated successfully' };
      } else {
        return { success: false, message: 'Confluence validation failed', error: 'auth_failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to connect to Confluence', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async sendGuideNotification(guide: Guide, config: IntegrationConfig, action: 'published' | 'updated' | 'deleted'): Promise<IntegrationResult> {
    return this.syncGuide!(guide, config);
  }

  async syncGuide(guide: Guide, config: IntegrationConfig): Promise<IntegrationResult> {
    const { domain, email, apiToken, spaceKey } = config;
    
    if (!domain || !email || !apiToken || !spaceKey) {
      return { success: false, message: 'Confluence configuration incomplete', error: 'missing_config' };
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

    try {
      const response = await fetch(`https://${domain}/wiki/rest/api/content`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'page',
          title: `[FlowCapture] ${guide.title}`,
          space: { key: spaceKey },
          body: {
            storage: {
              value: `<h2>${guide.title}</h2><p>${guide.description || 'No description'}</p><p><strong>Views:</strong> ${guide.viewCount}</p><p><strong>Status:</strong> ${guide.status}</p>`,
              representation: 'storage'
            }
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, message: 'Page published to Confluence', externalId: data.id };
      } else {
        const error = await response.json();
        return { success: false, message: `Failed to publish to Confluence: ${error.message || JSON.stringify(error)}`, error: 'publish_failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to publish to Confluence', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// =============================================================================
// TRELLO INTEGRATION
// =============================================================================
class TrelloProvider implements IntegrationProvider {
  name = 'trello';

  async validateCredentials(config: IntegrationConfig): Promise<IntegrationResult> {
    const { apiKey, apiToken } = config;
    
    if (!apiKey || !apiToken) {
      return { success: false, message: 'Trello API key and token are required', error: 'missing_credentials' };
    }

    try {
      const response = await fetch(`https://api.trello.com/1/members/me?key=${apiKey}&token=${apiToken}`);

      if (response.ok) {
        return { success: true, message: 'Trello credentials validated successfully' };
      } else {
        return { success: false, message: 'Trello validation failed', error: 'auth_failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to connect to Trello', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async sendGuideNotification(guide: Guide, config: IntegrationConfig, action: 'published' | 'updated' | 'deleted'): Promise<IntegrationResult> {
    const { apiKey, apiToken, listId } = config;
    
    if (!apiKey || !apiToken || !listId) {
      return { success: false, message: 'Trello configuration incomplete', error: 'missing_config' };
    }

    if (action === 'deleted') {
      return { success: true, message: 'No Trello action for deleted guides' };
    }

    const actionLabel = action === 'published' ? 'NEW' : 'UPDATED';

    try {
      const response = await fetch(`https://api.trello.com/1/cards?key=${apiKey}&token=${apiToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idList: listId,
          name: `[${actionLabel}] ${guide.title}`,
          desc: guide.description || 'No description',
          pos: 'top'
        })
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, message: 'Card created in Trello', externalId: data.id };
      } else {
        const error = await response.json();
        return { success: false, message: `Failed to create Trello card: ${error.message || JSON.stringify(error)}`, error: 'create_failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to create Trello card', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// =============================================================================
// ASANA INTEGRATION
// =============================================================================
class AsanaProvider implements IntegrationProvider {
  name = 'asana';

  async validateCredentials(config: IntegrationConfig): Promise<IntegrationResult> {
    const { accessToken } = config;
    
    if (!accessToken) {
      return { success: false, message: 'Asana access token is required', error: 'missing_token' };
    }

    try {
      const response = await fetch('https://app.asana.com/api/1.0/users/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.ok) {
        return { success: true, message: 'Asana credentials validated successfully' };
      } else {
        return { success: false, message: 'Asana validation failed', error: 'auth_failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to connect to Asana', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async sendGuideNotification(guide: Guide, config: IntegrationConfig, action: 'published' | 'updated' | 'deleted'): Promise<IntegrationResult> {
    const { accessToken, projectId } = config;
    
    if (!accessToken || !projectId) {
      return { success: false, message: 'Asana configuration incomplete', error: 'missing_config' };
    }

    if (action === 'deleted') {
      return { success: true, message: 'No Asana action for deleted guides' };
    }

    const actionLabel = action === 'published' ? 'New guide' : 'Updated guide';

    try {
      const response = await fetch('https://app.asana.com/api/1.0/tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: {
            name: `[FlowCapture] ${actionLabel}: ${guide.title}`,
            notes: guide.description || 'No description',
            projects: [projectId]
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, message: 'Task created in Asana', externalId: data.data.gid };
      } else {
        const error = await response.json();
        return { success: false, message: `Failed to create Asana task: ${error.errors?.[0]?.message || JSON.stringify(error)}`, error: 'create_failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to create Asana task', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// =============================================================================
// GOOGLE DRIVE INTEGRATION
// =============================================================================
class GoogleDriveProvider implements IntegrationProvider {
  name = 'google_drive';

  async validateCredentials(config: IntegrationConfig): Promise<IntegrationResult> {
    const { accessToken } = config;
    
    if (!accessToken) {
      return { success: false, message: 'Google Drive access token is required', error: 'missing_token' };
    }

    try {
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.ok) {
        return { success: true, message: 'Google Drive credentials validated successfully' };
      } else {
        return { success: false, message: 'Google Drive validation failed - token may be expired', error: 'auth_failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to connect to Google Drive', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async sendGuideNotification(guide: Guide, config: IntegrationConfig, action: 'published' | 'updated' | 'deleted'): Promise<IntegrationResult> {
    // Google Drive syncs documents, doesn't send notifications
    if (action === 'deleted') {
      return { success: true, message: 'No Google Drive action for deleted guides' };
    }
    return this.syncGuide!(guide, config);
  }

  async syncGuide(guide: Guide, config: IntegrationConfig): Promise<IntegrationResult> {
    const { accessToken, folderId } = config;
    
    if (!accessToken) {
      return { success: false, message: 'Google Drive access token not configured', error: 'missing_token' };
    }

    // Create a Google Doc with guide content
    const docContent = `
${guide.title}
${'='.repeat(guide.title.length)}

${guide.description || 'No description'}

Status: ${guide.status}
Views: ${guide.viewCount}
Last Updated: ${guide.updatedAt.toISOString()}
    `.trim();

    try {
      // Create file metadata
      const metadata = {
        name: `${guide.title}.txt`,
        mimeType: 'text/plain',
        ...(folderId && { parents: [folderId] })
      };

      // Create the file
      const boundary = 'flowcapture_boundary';
      const body = `--${boundary}
Content-Type: application/json; charset=UTF-8

${JSON.stringify(metadata)}

--${boundary}
Content-Type: text/plain

${docContent}
--${boundary}--`;

      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, message: 'Guide exported to Google Drive', externalId: data.id };
      } else {
        const error = await response.json();
        return { success: false, message: `Failed to export to Google Drive: ${error.error?.message || JSON.stringify(error)}`, error: 'export_failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to export to Google Drive', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// =============================================================================
// HUBSPOT INTEGRATION
// =============================================================================
class HubSpotProvider implements IntegrationProvider {
  name = 'hubspot';

  async validateCredentials(config: IntegrationConfig): Promise<IntegrationResult> {
    const { accessToken } = config;
    
    if (!accessToken) {
      return { success: false, message: 'HubSpot access token is required', error: 'missing_token' };
    }

    try {
      const response = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + accessToken, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      // Alternative: check account info
      const infoResponse = await fetch('https://api.hubapi.com/integrations/v1/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (response.ok || infoResponse.ok) {
        return { success: true, message: 'HubSpot credentials validated successfully' };
      } else {
        return { success: false, message: 'HubSpot validation failed', error: 'auth_failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to connect to HubSpot', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async sendGuideNotification(guide: Guide, config: IntegrationConfig, action: 'published' | 'updated' | 'deleted'): Promise<IntegrationResult> {
    const { accessToken } = config;
    
    if (!accessToken) {
      return { success: false, message: 'HubSpot access token not configured', error: 'missing_token' };
    }

    if (action === 'deleted') {
      return { success: true, message: 'No HubSpot action for deleted guides' };
    }

    // Create a note/engagement in HubSpot
    try {
      const response = await fetch('https://api.hubapi.com/engagements/v1/engagements', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          engagement: {
            active: true,
            type: 'NOTE'
          },
          metadata: {
            body: `[FlowCapture] Guide ${action}: ${guide.title}\n\n${guide.description || 'No description'}\n\nViews: ${guide.viewCount}`
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, message: 'Note created in HubSpot', externalId: data.engagement?.id?.toString() };
      } else {
        const error = await response.json();
        return { success: false, message: `Failed to create HubSpot note: ${error.message || JSON.stringify(error)}`, error: 'create_failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to create HubSpot note', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// =============================================================================
// MIXPANEL INTEGRATION (Analytics)
// =============================================================================
class MixpanelProvider implements IntegrationProvider {
  name = 'mixpanel';

  async validateCredentials(config: IntegrationConfig): Promise<IntegrationResult> {
    const { projectToken } = config;
    
    if (!projectToken) {
      return { success: false, message: 'Mixpanel project token is required', error: 'missing_token' };
    }

    // Mixpanel tokens can't be validated directly, just check format
    if (projectToken.length < 10) {
      return { success: false, message: 'Invalid Mixpanel project token format', error: 'invalid_format' };
    }

    return { success: true, message: 'Mixpanel project token saved' };
  }

  async sendGuideNotification(guide: Guide, config: IntegrationConfig, action: 'published' | 'updated' | 'deleted'): Promise<IntegrationResult> {
    const { projectToken } = config;
    
    if (!projectToken) {
      return { success: false, message: 'Mixpanel project token not configured', error: 'missing_token' };
    }

    // Track event in Mixpanel
    const event = {
      event: `guide_${action}`,
      properties: {
        token: projectToken,
        distinct_id: `guide_${guide.id}`,
        guide_id: guide.id,
        guide_title: guide.title,
        guide_status: guide.status,
        guide_views: guide.viewCount,
        time: Math.floor(Date.now() / 1000)
      }
    };

    try {
      const data = Buffer.from(JSON.stringify(event)).toString('base64');
      const response = await fetch(`https://api.mixpanel.com/track?data=${data}`);

      if (response.ok) {
        return { success: true, message: 'Event tracked in Mixpanel' };
      } else {
        return { success: false, message: 'Failed to track Mixpanel event', error: 'track_failed' };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Failed to track Mixpanel event', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// =============================================================================
// PROVIDER REGISTRY
// =============================================================================
const providers: Record<string, IntegrationProvider> = {
  slack: new SlackProvider(),
  microsoft_teams: new MicrosoftTeamsProvider(),
  notion: new NotionProvider(),
  jira: new JiraProvider(),
  confluence: new ConfluenceProvider(),
  trello: new TrelloProvider(),
  asana: new AsanaProvider(),
  google_drive: new GoogleDriveProvider(),
  hubspot: new HubSpotProvider(),
  mixpanel: new MixpanelProvider()
};

export function getProvider(providerName: string): IntegrationProvider | undefined {
  return providers[providerName];
}

export function getAllProviders(): IntegrationProvider[] {
  return Object.values(providers);
}

export async function validateIntegrationCredentials(
  providerName: string, 
  config: IntegrationConfig
): Promise<IntegrationResult> {
  const provider = getProvider(providerName);
  if (!provider) {
    return { success: false, message: `Unknown provider: ${providerName}`, error: 'unknown_provider' };
  }
  return provider.validateCredentials(config);
}

export async function triggerIntegrationSync(
  providerName: string,
  guide: Guide,
  config: IntegrationConfig,
  action: 'published' | 'updated' | 'deleted'
): Promise<IntegrationResult> {
  const provider = getProvider(providerName);
  if (!provider) {
    return { success: false, message: `Unknown provider: ${providerName}`, error: 'unknown_provider' };
  }
  return provider.sendGuideNotification(guide, config, action);
}
