/* Nocta — room for the device's own status area. A real web app gets the
 * phone's clock and battery from the phone; this only keeps content clear of
 * the notch (height: --sb-h, the safe-area inset — see base.css › .phone). */

export function StatusBar() {
  return <div className="statusbar" aria-hidden="true" />;
}
