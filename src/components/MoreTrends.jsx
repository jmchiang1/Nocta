/* Nocta — Trends › More trends: the power-user charts under the main one,
 * shared by the phone and desktop Trends so both show the same four, in the
 * same order. One value per night, straight from that night's card data
 * (data/trends.js › moreSeries); nights the card doesn't have it for are
 * gaps. Settings changes are marked on each (axes.markers). Plain data in
 * the metric blue: no scoring colours, no advice. */
import { trendAxes } from '../data/trends.js';
import { LineChart, Bars } from './Charts.jsx';

const empty = <span className="fn-nodata">Not recorded on these nights</span>;
const any = (arr) => arr?.some((v) => v != null);

export function moreTrendCharts(t, height) {
  const ax = (k, extra) => trendAxes(k, t.dates, { markers: t.markers, ...extra });
  return [
    {
      key: 'atMax',
      title: 'Time at your maximum pressure',
      meta: t.more.atMax,
      body: any(t.atMaxSeries) ? <Bars values={t.atMaxSeries} height={height} axes={ax('atMax')} /> : empty,
    },
    {
      key: 'maskOff',
      title: 'Mask-off breaks',
      meta: t.more.maskOff,
      body: any(t.maskOffSeries) ? (
        <Bars
          values={t.maskOffSeries}
          height={height}
          axes={ax('maskOff', {
            footer: (i) => (t.breaksSeries[i] == null ? '' : `${t.breaksSeries[i]} ${t.breaksSeries[i] === 1 ? 'break' : 'breaks'}`),
          })}
        />
      ) : (
        empty
      ),
    },
    {
      key: 'largeLeak',
      title: 'Large-leak minutes',
      meta: t.more.largeLeak,
      body: any(t.largeLeakSeries) ? <Bars values={t.largeLeakSeries} height={height} axes={ax('largeLeak')} /> : empty,
    },
    {
      key: 'flow',
      title: 'Flow limitation',
      meta: t.more.flow ? `95th percentile · ${t.more.flow}` : '95th percentile each night',
      body: any(t.flowSeries) ? <LineChart values={t.flowSeries} height={height} axes={ax('flow')} /> : empty,
    },
  ];
}
