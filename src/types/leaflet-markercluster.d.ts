/**
 * Minimal type augmentation for leaflet.markercluster plugin.
 * Adds MarkerClusterGroup and related types to the L (Leaflet) namespace.
 */
import * as L from 'leaflet';

declare module 'leaflet' {
  interface MarkerClusterGroupOptions {
    /** Max cluster radius in pixels (default 80). */
    maxClusterRadius?: number | ((zoom: number) => number);
    /** Custom icon factory for cluster icons. */
    iconCreateFunction?: (cluster: MarkerCluster) => L.Icon | L.DivIcon;
    /** Whether to spiderfy a cluster that can't expand (at maxZoom). Default true. */
    spiderfyOnMaxZoom?: boolean;
    /** Show polygon hull on hover. Default true. */
    showCoverageOnHover?: boolean;
    /** Zoom into bounds on cluster click. Default true. */
    zoomToBoundsOnClick?: boolean;
    /** Animate cluster expansion/collapse. Default true. */
    animate?: boolean;
    /** Don't cluster at this zoom level or above. */
    disableClusteringAtZoom?: number;
    /** Remove markers outside visible bounds from the map. Default true. */
    removeOutsideVisibleBounds?: boolean;
    /** Add markers in chunks to avoid freezing. Default false. */
    chunkedLoading?: boolean;
    /** Interval (ms) between chunks when chunkedLoading is true. */
    chunkedLoadingInterval?: number;
    /** Display single markers as clusters of 1. Default false. */
    singleMarkerMode?: boolean;
  }

  interface MarkerCluster extends L.Marker {
    getChildCount(): number;
    getAllChildMarkers(): L.Layer[];
    getBounds(): L.LatLngBounds;
  }

  // MarkerClusterGroup is a FeatureGroup — it implements addLayer/removeLayer.
  interface MarkerClusterGroup extends L.FeatureGroup {
    options: MarkerClusterGroupOptions;
    refreshClusters(layers?: L.Layer | L.Layer[] | L.LayerGroup): this;
  }

  function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup;
}
