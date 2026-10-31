with open('web/src/components/PropertyMap.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Replace drag state and handlers
old_drag_section = '''  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredProperty, setHoveredProperty] = useState<PropertyMapItem | null>(null);
  const [showAnchors, setShowAnchors] = useState(true);
  const [showRadius, setShowRadius] = useState(true);
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 600,
          height: containerRef.current.clientHeight || 600,
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Center map on initial load or properties change
  useEffect(() => {
    if (properties.length > 0) {
      const avgLat = properties.reduce((acc, p) => acc + p.lat, 0) / properties.length;
      const avgLng = properties.reduce((acc, p) => acc + p.lng, 0) / properties.length;
      setCenter({ lat: avgLat, lng: avgLng });
    }
  }, [properties]);

  // Center map when a property is selected
  useEffect(() => {
    if (selectedPropertyId) {
      const p = properties.find((item) => item.id === selectedPropertyId);
      if (p) {
        setCenter({ lat: p.lat, lng: p.lng });
      }
    }
  }, [selectedPropertyId, properties]);

  // Pan / Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setDragStart({ x: e.clientX, y: e.clientY });

    // Convert pixel delta to lat/lng delta at current zoom
    const centerP = project(center.lat, center.lng, zoom);
    const newCenterP = { x: centerP.x - dx, y: centerP.y - dy };

    // Reverse projection
    const n = Math.pow(2, zoom);
    const newLng = (newCenterP.x / 256 / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * newCenterP.y) / 256 / n)));
    const newLat = (latRad * 180) / Math.PI;

    setCenter({ lat: newLat, lng: newLng });
  };

  const handleMouseUp = () => setIsDragging(false);'''

new_drag_section = '''  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const [hoveredProperty, setHoveredProperty] = useState<PropertyMapItem | null>(null);
  const [showAnchors, setShowAnchors] = useState(true);
  const [showRadius, setShowRadius] = useState(true);
  const [isHudCollapsed, setIsHudCollapsed] = useState(false);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 600,
          height: containerRef.current.clientHeight || 600,
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Center map on initial load or properties change
  useEffect(() => {
    if (properties.length > 0) {
      const avgLat = properties.reduce((acc, p) => acc + p.lat, 0) / properties.length;
      const avgLng = properties.reduce((acc, p) => acc + p.lng, 0) / properties.length;
      setCenter({ lat: avgLat, lng: avgLng });
    }
  }, [properties]);

  // Center map when a property is selected (only if not currently dragging)
  useEffect(() => {
    if (selectedPropertyId && !isDraggingRef.current) {
      const p = properties.find((item) => item.id === selectedPropertyId);
      if (p) {
        setCenter({ lat: p.lat, lng: p.lng });
      }
    }
  }, [selectedPropertyId, properties]);

  // Unified Drag Handlers attached to window (zero drift, zero coordinate lag)
  const startDrag = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = { x: clientX, y: clientY };
    setIsDragging(true);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left mouse button only
    startDrag(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!isDraggingRef.current) return;
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        hasDraggedRef.current = true;
      }
      dragStartRef.current = { x: clientX, y: clientY };

      setCenter((prevCenter) => {
        const centerP = project(prevCenter.lat, prevCenter.lng, zoom);
        const newCenterP = { x: centerP.x - dx, y: centerP.y - dy };

        const n = Math.pow(2, zoom);
        const newLng = (newCenterP.x / 256 / n) * 360 - 180;
        const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * newCenterP.y) / 256 / n)));
        const newLat = (latRad * 180) / Math.PI;

        return { lat: newLat, lng: newLng };
      });
    };

    const handleEnd = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    };

    const onWindowMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onWindowMouseUp = () => handleEnd();
    const onWindowTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onWindowTouchEnd = () => handleEnd();

    window.addEventListener('mousemove', onWindowMouseMove, { passive: true });
    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('touchmove', onWindowTouchMove, { passive: true });
    window.addEventListener('touchend', onWindowTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('touchmove', onWindowTouchMove);
      window.removeEventListener('touchend', onWindowTouchEnd);
    };
  }, [zoom]);'''

assert old_drag_section in code, "old_drag_section not found"
code = code.replace(old_drag_section, new_drag_section)

# 2. Update container div listeners
old_container = '''    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-[#f1f2f4] border border-zinc-200 cursor-grab active:cursor-grabbing ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >'''

new_container = '''    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-[#f1f2f4] border border-zinc-200 cursor-grab active:cursor-grabbing ${className}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
    >'''

assert old_container in code, "old_container not found"
code = code.replace(old_container, new_container)

# 3. Update Anchor markers onClick and remove position transitions
old_anchor = '''            <div
              key={anchor.id}
              className="absolute z-25 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-105"
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectAnchor) onSelectAnchor(anchor);
              }}
            >'''

new_anchor = '''            <div
              key={anchor.id}
              className="absolute z-25 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
              onClick={(e) => {
                e.stopPropagation();
                if (hasDraggedRef.current) return;
                if (onSelectAnchor) onSelectAnchor(anchor);
              }}
            >'''

assert old_anchor in code, "old_anchor not found"
code = code.replace(old_anchor, new_anchor)

# 4. Update Property markers: remove transition-all on the positioning div!
old_marker = '''        return (
          <div
            key={property.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all ${
              isSelected ? 'z-40 scale-110' : isHovered ? 'z-35 scale-105' : 'z-20'
            }`}
            style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectProperty(property);
            }}
            onMouseEnter={() => setHoveredProperty(property)}
            onMouseLeave={() => setHoveredProperty(null)}
          >
            <div className="relative group">'''

new_marker = '''        return (
          <div
            key={property.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer ${
              isSelected ? 'z-40' : isHovered ? 'z-35' : 'z-20'
            }`}
            style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
            onClick={(e) => {
              e.stopPropagation();
              if (hasDraggedRef.current) return;
              onSelectProperty(property);
            }}
            onMouseEnter={() => setHoveredProperty(property)}
            onMouseLeave={() => setHoveredProperty(null)}
          >
            <div className={`relative group transition-transform duration-150 ${
              isSelected ? 'scale-110' : isHovered ? 'scale-105' : 'scale-100'
            }`}>'''

assert old_marker in code, "old_marker not found"
code = code.replace(old_marker, new_marker)

with open('web/src/components/PropertyMap.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("SUCCESS: PropertyMap.tsx patched with fixed coordinate drag lock!")

