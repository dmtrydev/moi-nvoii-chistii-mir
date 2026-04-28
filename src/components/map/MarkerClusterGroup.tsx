import { createLayerComponent } from '@react-leaflet/core';
import type { LeafletContextInterface, LeafletElement } from '@react-leaflet/core';
import type { LayerProps } from '@react-leaflet/core';
import L from 'leaflet';
import 'leaflet.markercluster/dist/leaflet.markercluster.js';
import type { ReactNode } from 'react';

import '@/styles/map-cluster.css';

// ─── Types ───────────────────────────────────────────────────────────────────
// leaflet.markercluster type augmentation lives in src/types/leaflet-markercluster.d.ts

export interface MarkerClusterGroupProps extends L.MarkerClusterGroupOptions, LayerProps {
  children?: ReactNode;
}

// ─── Default cluster icon factory ────────────────────────────────────────────
function defaultIconCreate(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  const size = count < 10 ? 36 : count < 100 ? 42 : 50;
  return L.divIcon({
    html: `<div class="map-cluster-icon map-cluster-icon--${count < 10 ? 'sm' : count < 100 ? 'md' : 'lg'}">${count}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ─── Component ───────────────────────────────────────────────────────────────
/**
 * Wraps leaflet.markercluster's MarkerClusterGroup as a react-leaflet component.
 * All react-leaflet Marker / CircleMarker children placed inside are automatically
 * added to the cluster group, enabling native clustering + canvas rendering.
 */
export const MarkerClusterGroup = createLayerComponent<
  L.MarkerClusterGroup,
  MarkerClusterGroupProps
>(function createMarkerClusterGroup(
  props: MarkerClusterGroupProps,
  ctx: LeafletContextInterface,
): LeafletElement<L.MarkerClusterGroup> {
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    children: _children,
    iconCreateFunction = defaultIconCreate,
    ...options
  } = props;

  const instance = L.markerClusterGroup({
    iconCreateFunction,
    chunkedLoading: true,
    removeOutsideVisibleBounds: true,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    animate: true,
    ...options,
  });

  return { instance, context: { ...ctx, layerContainer: instance } };
});
