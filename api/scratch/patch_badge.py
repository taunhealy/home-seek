with open('web/src/components/PropertyMap.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_block = '''                  {/* Primary connection line */}
                  <line
                    x1={propPos.x}
                    y1={propPos.y}
                    x2={aPos.x}
                    y2={aPos.y}
                    stroke={isTarget ? "#09090b" : "#71717a"}
                    strokeWidth={isTarget ? "2.2" : "1.2"}
                    strokeDasharray={isTarget ? "6 4" : "4 4"}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* 3. Floating Commute Badges along vectors to each anchor */}
      {propPos && showAnchors && anchors.map((anchor) => {
        const aPos = getScreenPos(anchor.lat, anchor.lng);
        const isTarget = activeAnchor?.id === anchor.id;
        
        // Find if selectedProp has precalculated proximity
        const prox = selectedProp?.location_proximity?.find(
          (p: any) => 
            (p.label && anchor.label && p.label.toLowerCase() === anchor.label.toLowerCase()) ||
            (p.target_place && anchor.target_place && p.target_place.toLowerCase().includes(anchor.target_place.toLowerCase()))
        );
        
        const distKm = prox?.distance_km ?? calculateDistanceKm(selectedProp.lat, selectedProp.lng, anchor.lat, anchor.lng);
        const distText = prox?.distance_text ?? `${distKm} km`;
        const durText = prox?.duration_text ?? `~${Math.max(3, Math.round(distKm * 1.6 + 4))} mins`;

        // Position badge at 70% along the path towards the anchor to prevent colliding with property origin cluster
        const badgeX = propPos.x + (aPos.x - propPos.x) * 0.70;
        const badgeY = propPos.y + (aPos.y - propPos.y) * 0.70;

        return (
          <div
            key={`badge-${anchor.id}`}
            className="absolute z-15 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${badgeX}px`,
              top: `${badgeY}px`,
            }}
          >
            <div className={`px-2.5 py-1 rounded-full shadow-md border flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap backdrop-blur-md animate-in fade-in duration-200 ${
              isTarget 
                ? 'bg-zinc-950/90 text-white border-zinc-700 ring-2 ring-zinc-400/50' 
                : 'bg-white/90 text-zinc-800 border-zinc-200/90'
            }`}>
              <Car size={13} weight="bold" className={isTarget ? "text-emerald-400" : "text-zinc-600"} />
              <span>{durText}</span>
              <span className="opacity-40">·</span>
              <span>{distText}</span>
            </div>
          </div>
        );
      })}'''

new_block = '''                  {/* Primary connection line */}
                  <line
                    x1={propPos.x}
                    y1={propPos.y}
                    x2={aPos.x}
                    y2={aPos.y}
                    stroke={isTarget ? "#4f46e5" : "#a1a1aa"}
                    strokeWidth={isTarget ? "2.5" : "1.2"}
                    strokeDasharray={isTarget ? "6 4" : "4 4"}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* 3. Floating Commute Badges along vectors to each anchor */}
      {propPos && showAnchors && anchors.map((anchor) => {
        const aPos = getScreenPos(anchor.lat, anchor.lng);
        const isTarget = activeAnchor?.id === anchor.id;
        
        // Find if selectedProp has precalculated proximity
        const prox = selectedProp?.location_proximity?.find(
          (p: any) => 
            (p.label && anchor.label && p.label.toLowerCase() === anchor.label.toLowerCase()) ||
            (p.target_place && anchor.target_place && p.target_place.toLowerCase().includes(anchor.target_place.toLowerCase()))
        );
        
        const distKm = prox?.distance_km ?? calculateDistanceKm(selectedProp.lat, selectedProp.lng, anchor.lat, anchor.lng);
        const distText = prox?.distance_text ?? `${distKm} km`;
        const durText = prox?.duration_text ?? `~${Math.max(3, Math.round(distKm * 1.6 + 4))} mins`;

        // Position badge close to the apartment along the route vector (clamped at ~48-64px from property)
        const dx = aPos.x - propPos.x;
        const dy = aPos.y - propPos.y;
        const totalPixels = Math.hypot(dx, dy);

        let t = 0.22;
        if (totalPixels > 0) {
          const minRatio = Math.min(0.5, 48 / totalPixels);
          t = Math.max(minRatio, Math.min(0.28, 64 / totalPixels));
        }

        const badgeX = propPos.x + dx * t;
        const badgeY = propPos.y + dy * t;

        const isWalking = distKm <= 1.2 || anchor.commute_mode === 'walking';
        const isBiking = anchor.commute_mode === 'bicycling';

        return (
          <div
            key={`badge-${anchor.id}`}
            className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${badgeX}px`,
              top: `${badgeY}px`,
            }}
          >
            <div className={`px-3 py-1 rounded-full shadow-lg border-2 flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap backdrop-blur-md animate-in fade-in duration-150 ${
              isTarget 
                ? 'bg-indigo-600 text-white border-white ring-4 ring-indigo-500/25 shadow-indigo-950/20' 
                : 'bg-white text-indigo-950 border-indigo-200 shadow-md ring-1 ring-zinc-950/5'
            }`}>
              {isWalking ? (
                <PersonSimpleWalk size={13} weight="bold" className={isTarget ? "text-amber-300" : "text-indigo-600"} />
              ) : isBiking ? (
                <Bicycle size={13} weight="bold" className={isTarget ? "text-amber-300" : "text-indigo-600"} />
              ) : (
                <Car size={13} weight="fill" className={isTarget ? "text-amber-300" : "text-indigo-600"} />
              )}
              <span className="font-extrabold">{durText}</span>
              <span className={isTarget ? "text-indigo-200 font-bold" : "text-zinc-400 font-bold"}>·</span>
              <span className={isTarget ? "text-indigo-100 font-semibold" : "text-zinc-600 font-medium"}>{distText}</span>
            </div>
          </div>
        );
      })}'''

assert old_block in text, "old_block not found in PropertyMap.tsx"
text = text.replace(old_block, new_block)

with open('web/src/components/PropertyMap.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: PropertyMap.tsx distance badge repositioned closer to apartment with high contrast styling!")

