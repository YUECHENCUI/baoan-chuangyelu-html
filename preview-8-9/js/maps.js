/* Shared MapLibre engine for corridor sequence + beer–Xili map.
 * Approximate coordinates — schematic for briefing, not surveyed GIS.
 *
 * Default basemap: Gaode/Amap satellite (GCJ-02), tiles
 *   webst0{1-4}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}
 * Research coords in map-coords.md are WGS84. Amap rasters are GCJ-02, so
 * we shift overlays by ~+0.005° E/N in Shenzhen (~300–600 m) so the masterplan
 * roughly sits on the Bao'an corridor at zoom ~12. Not a precise wgs84togcj02.
 */
(function () {
  const AMAP_SAT = {
    tiles: [1, 2, 3, 4].map(
      (n) =>
        `https://webst0${n}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}`
    ),
    attribution: '© AutoNavi / 高德',
    tileSize: 256,
    maxzoom: 18
  };
  // Optional WGS84 fallback (Esri) — not default; China rooms prefer Amap.
  const ESRI = {
    tiles: [
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ],
    attribution: 'Imagery © Esri',
    tileSize: 256,
    maxzoom: 19
  };

  /** Fixed GCJ-02 nudge applied to WGS84 research coords for Amap basemap. */
  const GCJ = { lng: 0.005, lat: 0.005 };
  function gcj(lng, lat) {
    return [lng + GCJ.lng, lat + GCJ.lat];
  }
  function gcjPt(p) {
    return { ...p, lng: p.lng + GCJ.lng, lat: p.lat + GCJ.lat };
  }

  // Approximate georeference of image16 masterplan plate over Bao'an corridor.
  // Soft-blend + lower opacity lets live satellite show east of 尖岗山.
  const MASTER_BOUNDS_WGS = [
    [113.865, 22.595], // TL
    [113.950, 22.595], // TR — plate ends; live sat continues east
    [113.950, 22.530], // BR
    [113.865, 22.530] // BL
  ];
  const MASTER_BOUNDS = {
    coordinates: MASTER_BOUNDS_WGS.map(([lng, lat]) => gcj(lng, lat))
  };

  const CAMERAS = {
    overview: {
      center: gcj(113.91, 22.575),
      zoom: 12.2,
      pitch: 45,
      bearing: -20
    },
    baozhong: {
      center: gcj(113.885, 22.548),
      zoom: 14.0,
      pitch: 40,
      bearing: -18
    },
    harbor: {
      center: gcj(113.885, 22.545),
      zoom: 14.6,
      pitch: 35,
      bearing: -16
    },
    lingzhi: {
      center: gcj(113.8992, 22.572),
      zoom: 14.2,
      pitch: 40,
      bearing: -15
    },
    jiangang: {
      center: gcj(113.915, 22.583),
      zoom: 13.8,
      pitch: 40,
      bearing: 10
    }
  };

  // Schematic enterprise clusters for 具身智能港 (from image17 legend categories).
  const ENTERPRISES = [
    { name: '优必选', cat: '本体企业', lng: 113.878, lat: 22.548 },
    { name: '节卡机器人', cat: '本体企业', lng: 113.882, lat: 22.542 },
    { name: '傅利叶', cat: '本体企业', lng: 113.888, lat: 22.540 },
    { name: '银河通用', cat: '本体企业', lng: 113.891, lat: 22.546 },
    { name: '海柔创新', cat: '本体企业', lng: 113.885, lat: 22.538 },
    { name: '慧灵科技', cat: '本体企业', lng: 113.893, lat: 22.550 },
    { name: '横川机器人', cat: '本体企业', lng: 113.876, lat: 22.544 },
    { name: '零一云控', cat: '本体企业', lng: 113.880, lat: 22.552 },
    { name: '思谋科技', cat: '数据服务', lng: 113.887, lat: 22.536 },
    { name: '途见科技', cat: '数据服务', lng: 113.894, lat: 22.542 },
    { name: '感知服务A', cat: '数据服务', lng: 113.883, lat: 22.550 },
    { name: '数据节点B', cat: '数据服务', lng: 113.896, lat: 22.547 },
    { name: '兆威机电', cat: '核心零部件', lng: 113.874, lat: 22.540 },
    { name: '大族智控', cat: '核心零部件', lng: 113.890, lat: 22.552 },
    { name: '核心部件B', cat: '核心零部件', lng: 113.892, lat: 22.535 },
    { name: '核心部件C', cat: '核心零部件', lng: 113.871, lat: 22.546 }
  ].map(gcjPt);

  const CAT_COLOR = {
    本体企业: '#5cb88a',
    数据服务: '#e08a3c',
    核心零部件: '#d45a4a'
  };

  const BEER = {
    beerTown: gcjPt({
      lng: 113.915,
      lat: 22.583,
      label: '啤酒小镇 / 雪花科创城'
    }),
    liuxian: gcjPt({ lng: 113.9391, lat: 22.5834, label: '留仙洞总部基地' }),
    xiliHub: gcjPt({
      lng: 113.9402,
      lat: 22.57,
      label: '西丽枢纽（高铁）'
    }),
    route: [
      [113.915, 22.583],
      [113.922, 22.585],
      [113.93, 22.5845],
      [113.9391, 22.5834],
      [113.9402, 22.57]
    ].map(([lng, lat]) => gcj(lng, lat))
  };

  const DISTRICT_RINGS = [
    { id: 'baozhong', coords: gcj(113.8823, 22.5576) },
    { id: 'lingzhi', coords: gcj(113.8992, 22.572) },
    { id: 'jiangang', coords: gcj(113.915, 22.583) }
  ];

  let sharedMap = null;
  let sharedReady = false;
  let beerMap = null;
  let basemapKind = 'amap';

  function styleFor(kind) {
    const src = kind === 'esri' ? ESRI : AMAP_SAT;
    return {
      version: 8,
      sources: {
        sat: {
          type: 'raster',
          tiles: src.tiles,
          tileSize: src.tileSize,
          maxzoom: src.maxzoom,
          attribution: src.attribution
        }
      },
      layers: [{ id: 'sat', type: 'raster', source: 'sat' }]
    };
  }

  function ensureShared() {
    if (sharedMap) return sharedMap;
    const el = document.getElementById('shared-map');
    if (!el || !window.maplibregl) return null;
    basemapKind = 'amap';
    sharedMap = new maplibregl.Map({
      container: el,
      style: styleFor('amap'),
      center: CAMERAS.overview.center,
      zoom: CAMERAS.overview.zoom,
      pitch: 0,
      bearing: -4,
      attributionControl: true,
      maxPitch: 55
    });
    sharedMap.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      'bottom-right'
    );
    sharedMap.on('load', () => {
      sharedReady = true;
      addMasterOverlay();
      addDistrictRings();
      addEnterpriseLayer();
      setOverlayMode(window.__mapMode || 'overview');
      sharedMap.resize();
    });
    return sharedMap;
  }

  function addMasterOverlay() {
    if (sharedMap.getSource('masterplan')) return;
    sharedMap.addSource('masterplan', {
      type: 'image',
      url: 'assets/image16-web.jpg',
      coordinates: MASTER_BOUNDS.coordinates
    });
    sharedMap.addLayer({
      id: 'masterplan',
      type: 'raster',
      source: 'masterplan',
      paint: {
        'raster-opacity': 0.78,
        'raster-fade-duration': 0
      }
    });
  }

  function addDistrictRings() {
    const rings = {
      type: 'FeatureCollection',
      features: DISTRICT_RINGS.map((d) => ({
        type: 'Feature',
        properties: { id: d.id },
        geometry: { type: 'Point', coordinates: d.coords }
      }))
    };
    if (sharedMap.getSource('districts')) return;
    sharedMap.addSource('districts', { type: 'geojson', data: rings });
    sharedMap.addLayer({
      id: 'district-glow',
      type: 'circle',
      source: 'districts',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          11,
          40,
          13,
          70,
          15,
          110
        ],
        'circle-color': '#d4a84b',
        'circle-opacity': 0.08,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#d4a84b',
        'circle-stroke-opacity': 0.75
      }
    });
  }

  function addEnterpriseLayer() {
    const fc = {
      type: 'FeatureCollection',
      features: ENTERPRISES.map((e) => ({
        type: 'Feature',
        properties: { name: e.name, cat: e.cat, color: CAT_COLOR[e.cat] },
        geometry: { type: 'Point', coordinates: [e.lng, e.lat] }
      }))
    };
    if (sharedMap.getSource('enterprises')) return;
    sharedMap.addSource('enterprises', { type: 'geojson', data: fc });
    sharedMap.addLayer({
      id: 'enterprises',
      type: 'circle',
      source: 'enterprises',
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          12,
          4,
          14,
          7,
          16,
          10
        ],
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 1.2,
        'circle-stroke-color': '#0a0a0b',
        'circle-opacity': 0.92
      }
    });
    sharedMap.addLayer({
      id: 'enterprise-labels',
      type: 'symbol',
      source: 'enterprises',
      layout: {
        visibility: 'none',
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-offset': [0, 1.2],
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'text-allow-overlap': false
      },
      paint: {
        'text-color': '#f4f0e8',
        'text-halo-color': '#0a0a0b',
        'text-halo-width': 1.2
      }
    });
    sharedMap.on('click', 'enterprises', (e) => {
      const f = e.features[0];
      new maplibregl.Popup({ offset: 12 })
        .setLngLat(f.geometry.coordinates)
        .setHTML(
          `<strong>${f.properties.name}</strong><br><span style="opacity:.7">${f.properties.cat}</span><br><span style="opacity:.45;font-size:10px">示意点位 · schematic</span>`
        )
        .addTo(sharedMap);
    });
    sharedMap.on('mouseenter', 'enterprises', () => {
      sharedMap.getCanvas().style.cursor = 'pointer';
    });
    sharedMap.on('mouseleave', 'enterprises', () => {
      sharedMap.getCanvas().style.cursor = '';
    });
  }

  function setOverlayMode(mode) {
    window.__mapMode = mode;
    if (!sharedMap || !sharedReady) {
      const wait = () => {
        if (sharedReady) setOverlayMode(mode);
        else setTimeout(wait, 80);
      };
      wait();
      return;
    }
    const showMaster =
      mode === 'overview' ||
      mode === 'baozhong' ||
      mode === 'lingzhi' ||
      mode === 'jiangang';
    const showEnterprises = mode === 'harbor';
    const showRings = mode === 'overview';
    if (sharedMap.getLayer('masterplan')) {
      sharedMap.setPaintProperty(
        'masterplan',
        'raster-opacity',
        mode === 'overview'
          ? 0.78
          : mode === 'baozhong'
            ? 0.72
            : mode === 'lingzhi'
              ? 0.72
              : mode === 'jiangang'
                ? 0.68
                : 0.15
      );
      sharedMap.setLayoutProperty(
        'masterplan',
        'visibility',
        showMaster || mode === 'harbor' ? 'visible' : 'none'
      );
      if (mode === 'harbor') {
        sharedMap.setPaintProperty('masterplan', 'raster-opacity', 0.22);
      }
    }
    if (sharedMap.getLayer('district-glow')) {
      sharedMap.setLayoutProperty(
        'district-glow',
        'visibility',
        showRings ? 'visible' : 'none'
      );
    }
    if (sharedMap.getLayer('enterprises')) {
      sharedMap.setLayoutProperty(
        'enterprises',
        'visibility',
        showEnterprises ? 'visible' : 'none'
      );
      sharedMap.setLayoutProperty(
        'enterprise-labels',
        'visibility',
        showEnterprises ? 'visible' : 'none'
      );
    }
  }

  function flyTo(mode, duration) {
    const cam = CAMERAS[mode] || CAMERAS.overview;
    ensureShared();
    const run = () => {
      setOverlayMode(mode);
      sharedMap.resize();
      sharedMap.easeTo({
        center: cam.center,
        zoom: cam.zoom,
        pitch: cam.pitch,
        bearing: cam.bearing,
        duration: duration == null ? 1400 : duration,
        easing: (t) => 1 - Math.pow(1 - t, 3)
      });
    };
    if (sharedReady) run();
    else sharedMap.once('load', run);
  }

  function showShared(on) {
    const root = document.getElementById('shared-map-root');
    if (!root) return;
    if (on) {
      ensureShared();
      root.classList.add('is-on');
      // Force visibility above black slide stacking; resize after paint
      requestAnimationFrame(() => {
        if (sharedMap) {
          sharedMap.resize();
          requestAnimationFrame(() => sharedMap.resize());
        }
      });
    } else {
      root.classList.remove('is-on');
    }
  }

  function initBeerMap() {
    const el = document.getElementById('beer-map');
    if (!el || !window.maplibregl || beerMap) {
      if (beerMap) {
        beerMap.resize();
        return beerMap;
      }
      return null;
    }
    beerMap = new maplibregl.Map({
      container: el,
      style: styleFor('amap'),
      center: gcj(113.93, 22.578),
      zoom: 12.9,
      pitch: 40,
      bearing: -10,
      attributionControl: true
    });
    beerMap.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      'bottom-right'
    );
    beerMap.on('load', () => {
      beerMap.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: BEER.route }
        }
      });
      beerMap.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#d4a84b',
          'line-width': 10,
          'line-opacity': 0.22,
          'line-blur': 4
        }
      });
      beerMap.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#7ec8e3',
          'line-width': 3.5,
          'line-opacity': 0.95
        }
      });

      const nodes = [
        { ...BEER.beerTown, color: '#d4a84b' },
        { ...BEER.liuxian, color: '#7ec8e3' },
        { ...BEER.xiliHub, color: '#d45a4a' }
      ];
      nodes.forEach((n) => {
        const markerEl = document.createElement('div');
        markerEl.className = 'poi-marker';
        markerEl.innerHTML = `<i style="background:${n.color}"></i><span>${n.label}</span>`;
        new maplibregl.Marker({ element: markerEl, anchor: 'left' })
          .setLngLat([n.lng, n.lat])
          .addTo(beerMap);
      });

      beerMap.addSource('nodes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: nodes.map((n) => ({
            type: 'Feature',
            properties: { color: n.color },
            geometry: { type: 'Point', coordinates: [n.lng, n.lat] }
          }))
        }
      });
      beerMap.addLayer({
        id: 'node-rings',
        type: 'circle',
        source: 'nodes',
        paint: {
          'circle-radius': 28,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.12,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': 0.8
        }
      });
      beerMap.resize();
    });
    return beerMap;
  }

  const style = document.createElement('style');
  style.textContent = `
    .poi-marker { display:flex; align-items:center; gap:8px; pointer-events:none; }
    .poi-marker i { width:12px; height:12px; border-radius:50%; box-shadow:0 0 0 3px rgba(0,0,0,.45); flex:0 0 auto; }
    .poi-marker span {
      background: rgba(10,10,12,.82); color:#f4f0e8; border:1px solid rgba(212,168,75,.35);
      padding:5px 9px; font-size:12px; letter-spacing:.04em; white-space:nowrap;
      backdrop-filter: blur(8px);
    }
  `;
  document.head.appendChild(style);

  window.DeckMaps = {
    ensureShared,
    showShared,
    flyTo,
    setOverlayMode,
    initBeerMap,
    CAMERAS,
    basemapKind: () => basemapKind
  };
})();
