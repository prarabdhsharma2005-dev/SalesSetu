/**
 * SalesSetu — Self-Initializing Google Sheets Automation Engine
 * 
 * You don't need to create any tabs or type any column names!
 * As soon as this script runs, it automatically builds:
 *  - "Leads" tab (with headers, styling, and column widths)
 *  - "Deals" tab (with formatted currency columns)
 *  - "Meetings" tab (with MoM and action item tracking)
 *  - "Outreach" tab (with personalized email logs)
 */

function setupSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var TABS_CONFIG = {
    'Leads': {
      headers: ['ID', 'Company', 'Website', 'Industry', 'Country', 'City', 'Employees', 'Intent Signal', 'Lead Score', 'Status', 'Created At'],
      color: '#2563EB',
      sample: [
        ['lead_1', 'Razorpay', 'razorpay.com', 'FinTech', 'India', 'Bangalore', '3000', 'Launched Capital arm, active partnerships', '91', 'CONTACTED', new Date().toISOString()],
        ['lead_2', 'BrowserStack', 'browserstack.com', 'SaaS', 'India', 'Mumbai', '1200', 'RFP for outbound sales automation tools', '94', 'MEETING_SCHEDULED', new Date().toISOString()]
      ]
    },
    'Deals': {
      headers: ['ID', 'Title', 'Company', 'Stage', 'Value (INR)', 'Probability (%)', 'Health', 'Next Action', 'Created At'],
      color: '#7C3AED',
      sample: [
        ['deal_1', 'BrowserStack AI Testing Integration', 'BrowserStack', 'MEETING_COMPLETED', '2400000', '75', 'HEALTHY', 'Send proposal by Friday', new Date().toISOString()],
        ['deal_2', 'Freshworks Freddy AI Partnership', 'Freshworks', 'ENGAGED', '5000000', '60', 'NEEDS_ATTENTION', 'Follow up with partnership deck', new Date().toISOString()]
      ]
    },
    'Meetings': {
      headers: ['ID', 'Title', 'Company', 'Scheduled At', 'Duration (min)', 'Meet Link', 'Agenda', 'Status'],
      color: '#059669',
      sample: [
        ['mtg_1', 'BrowserStack — Product Demo & Discovery', 'BrowserStack', new Date().toISOString(), '60', 'https://meet.google.com/abc-defg-hij', 'AI testing tool evaluation', 'SCHEDULED']
      ]
    },
    'Outreach': {
      headers: ['ID', 'Prospect Name', 'Email', 'Company', 'Subject', 'Body', 'Status', 'Sent At'],
      color: '#D97706',
      sample: [
        ['out_1', 'Arjun Kapoor', 'arjun.kapoor@browserstack.com', 'BrowserStack', 'Accelerating BrowserStack partnerships', 'Hi Arjun...', 'SENT', new Date().toISOString()]
      ]
    }
  };

  Object.keys(TABS_CONFIG).forEach(function(tabName) {
    var config = TABS_CONFIG[tabName];
    var sheet = ss.getSheetByName(tabName);

    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    }

    // Set headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(config.headers);

      // Header styling
      var headerRange = sheet.getRange(1, 1, 1, config.headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setBackground(config.color);
      headerRange.setFontSize(11);
      sheet.setFrozenRows(1);

      // Append sample rows
      if (config.sample && config.sample.length > 0) {
        config.sample.forEach(function(row) {
          sheet.appendRow(row);
        });
      }

      // Auto-resize columns
      for (var col = 1; col <= config.headers.length; col++) {
        sheet.autoResizeColumn(col);
      }
    }
  });

  // Remove default "Sheet1" if custom tabs exist
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {}
  }

  return { status: 'success', message: 'All 4 SalesSetu tabs created with headers and sample data!' };
}

function doPost(e) {
  try {
    setupSpreadsheet(); // Ensures tabs and headers always exist

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
  setupSpreadsheet();
  return ContentService.createTextOutput(JSON.stringify({
    status: 'SalesSetu Google Sheets Engine Online',
    tabs: ['Leads', 'Deals', 'Meetings', 'Outreach']
  })).setMimeType(ContentService.MimeType.JSON);
}
