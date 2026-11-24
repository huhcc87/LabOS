/** Pop-down guide for the Labels page: print, reagent labels, scan & store. */
export default function LabelsHowToUse() {
  return (
    <details className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>How to use Labels</summary>
      <div style={{ fontSize: 14, lineHeight: 1.7, marginTop: 10 }}>
        <strong>Print labels</strong>
        <ol style={{ margin: '4px 0 12px', paddingLeft: 20 }}>
          <li><strong>What are you labelling?</strong> Pick sample, reagent, equipment and so on. This sets the starting fields and the ID.</li>
          <li><strong>Label size.</strong> Choose your label sheet or roll size so the print matches your stickers.</li>
          <li><strong>Label Style &amp; Font.</strong> Change the font, text sizes and colours. <em>Reset all</em> goes back to the defaults.</li>
          <li><strong>Label fields.</strong> Tick the fields to show, edit a field's name or value, or use <em>+ Add field</em> for your own.</li>
          <li><strong>Print options.</strong> Set the number of copies and the brand text, check the preview, then print (scale 100%, margins none).</li>
        </ol>
        <strong>Reagent &amp; lot labels</strong>
        <p style={{ margin: '4px 0 12px' }}>Make a label for a stock item or lot so it can be scanned later.</p>
        <strong>Scan &amp; store</strong>
        <p style={{ margin: '4px 0 0' }}>Click on the page, then scan a label with a USB scanner (or type its code and press Enter). Samples get stored, stock can be used or relabelled, and open orders go to Receiving.</p>
      </div>
    </details>
  );
}
