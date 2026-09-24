/**
 * SalesSetu — Google Sheets Webhook Script
 * 
 * Setup Instructions:
 * 1. Open Google Sheets (https://sheets.new)
 * 2. Create 4 tabs: "Leads", "Deals", "Meetings", "Outreach"
 * 3. Add column headers to Row 1 of each tab:
 *    - Leads: ID | Company | Website | Industry | Country | City | Employees | Intent Signal | Lead Score | Status | Created At
 *    - Deals: ID | Title | Company | Stage | Value | Probability | Health | Next Action | Created At
 *    - Meetings: ID | Title | Company | Date | Attendees | Summary | Action Items | Sentiment
 *    - Outreach: ID | Prospect Name | Email | Company | Subject | Body | Status | Sent At
 * 4. In Google Sheets, click: Extensions -> Apps Script
 * 5. Paste this entire file into Code.gs
 * 6. Click "Deploy" -> "New deployment" -> Select type: "Web app"
 * 7. Set:
 *    - Execute as: "Me"
 *    - Who has access: "Anyone"
 * 8. Click Deploy and copy the Web App URL!
 * 9. Paste the URL into backend/.env as GOOGLE_SHEETS_WEBHOOK_URL
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheetName = data.tab || 'Leads';
    var payload = data.payload || {};
    var action = data.action || 'APPEND';

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    if (action === 'APPEND') {
      var row = Object.values(payload);
      sheet.appendRow(row);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', tab: sheetName }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ status: 'SalesSetu Google Sheets Webhook Active' }))
    .setMimeType(ContentService.MimeType.JSON);
}
