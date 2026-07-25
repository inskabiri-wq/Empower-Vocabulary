/**
 * Lingualab one-page site - Google Apps Script web app entry point.
 *
 * Serves index.html as a public web page. The page is fully
 * self-contained (all CSS/JS inline), so this is the only server
 * code you need.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Lingualab')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
