import type { HTMLAttributes } from "react";

/**
 * Rig-ready rooster SVG — named groups with fixed pivots matching
 * mascot/rooster.svg. Pivot dots are for the demo "show bone pivots" toggle
 * (parent adds `.showpivots`).
 */
export function RoosterFigure({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={["mascot-rooster", className].filter(Boolean).join(" ")}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 420 400"
        className="block h-auto w-full overflow-visible"
        aria-hidden
      >
        <g
          id="Rooster"
          fill="none"
          stroke="#17110D"
          strokeWidth="8"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <g id="tail">
            <path
              id="tail_c"
              fill="#2C8496"
              d="M136 254 C106 250 78 242 52 228 C34 218 48 190 66 200 C90 214 118 228 172 240 Z"
            />
            <path
              id="tail_b"
              fill="#1B5C6B"
              d="M140 228 C114 212 86 190 64 164 C51 148 78 124 92 140 C114 166 142 190 180 210 Z"
            />
            <path
              id="tail_a"
              fill="#3E9FB0"
              d="M150 198 C134 174 116 146 104 112 C96 92 132 82 140 102 C152 136 170 164 194 186 Z"
            />
          </g>

          <g id="leg_back">
            <path
              id="leg_back_shank"
              fill="#C98A25"
              d="M158 264 L184 264 L180 344 L162 344 Z"
            />
            <path
              id="leg_back_foot"
              fill="#C98A25"
              d="M157 340 L185 340 L201 350 C207 354 205 358 199 358 L141 358 C134 358 133 351 138 347 Z"
            />
            <path
              id="leg_back_toe"
              strokeWidth="5"
              d="M176 344 C180 349 185 353 192 355"
            />
          </g>

          <g id="neck">
            <path
              id="neck_shape"
              fill="#D96A28"
              d="M218 200 C206 168 216 134 244 114 C256 106 278 110 286 124 C296 144 294 172 292 192 C288 202 278 206 268 208 Z"
            />
          </g>

          <g id="body">
            <path
              id="body_shape"
              fill="#E07B2C"
              d="M250 174 C276 198 276 242 254 268 C232 294 176 296 142 280 C106 263 92 224 106 194 C122 160 172 146 208 152 C228 155 242 164 250 174 Z"
            />
          </g>

          <g id="wing">
            <path
              id="wing_shape"
              fill="#C25A1E"
              d="M248 200 C258 228 246 258 220 272 C202 281 180 282 162 277 L142 284 C146 268 144 250 152 236 C172 208 220 186 248 200 Z"
            />
            <path
              id="wing_line_1"
              strokeWidth="6"
              d="M236 216 C218 234 192 246 164 250"
            />
            <path
              id="wing_line_2"
              strokeWidth="6"
              d="M242 242 C228 258 206 268 182 272"
            />
          </g>

          <g id="leg_front">
            <path
              id="leg_front_shank"
              fill="#F7C948"
              d="M210 270 L236 270 L232 350 L214 350 Z"
            />
            <path
              id="leg_front_foot"
              fill="#F7C948"
              d="M209 346 L237 346 L253 356 C259 360 257 364 251 364 L193 364 C186 364 185 357 190 353 Z"
            />
            <path
              id="leg_front_toe"
              strokeWidth="5"
              d="M228 350 C232 355 237 359 244 361"
            />
          </g>

          <g id="head_rig">
            <g id="wattle">
              <path
                id="wattle_shape"
                fill="#E34A35"
                d="M284 136 C270 160 270 194 290 202 C308 209 322 194 320 174 C318 156 306 142 296 134 Z"
              />
            </g>
            <g id="comb">
              <path
                id="comb_shape"
                fill="#E34A35"
                d="M252 74 C244 46 262 24 280 42 C288 14 314 16 316 44 C328 26 350 34 344 60 C340 74 326 84 310 86 C286 90 260 84 252 74 Z"
              />
            </g>
            <g id="head">
              <path
                id="head_shape"
                fill="#E8873A"
                d="M244 116 C244 82 268 56 302 56 C334 56 356 80 356 110 C356 134 344 152 324 162 C300 173 262 166 250 146 C245 138 244 127 244 116 Z"
              />
            </g>
            <g id="beak_lower">
              <path
                id="beak_lower_shape"
                fill="#D9A32E"
                d="M348 118 C366 123 384 119 394 113 C386 128 366 136 350 131 Z"
              />
            </g>
            <g id="beak_upper">
              <path
                id="beak_upper_shape"
                fill="#F7C948"
                d="M346 90 C372 90 392 99 400 107 C390 115 366 121 348 117 Z"
              />
            </g>
            <g id="eye">
              <ellipse
                id="eye_white"
                cx="306"
                cy="104"
                rx="18"
                ry="19"
                fill="#FBF6EA"
              />
              <circle
                id="eye_pupil"
                cx="312"
                cy="105"
                r="9.5"
                fill="#17110D"
                stroke="none"
              />
              <circle
                id="eye_shine"
                cx="307"
                cy="99"
                r="3.5"
                fill="#FBF6EA"
                stroke="none"
              />
              <ellipse
                id="eye_lid"
                cx="306"
                cy="104"
                rx="19"
                ry="20"
                fill="#E8873A"
                stroke="none"
                transform="translate(306 84) scale(1 0) translate(-306 -84)"
              />
              <path
                id="eye_closed"
                stroke="#17110D"
                strokeWidth="6"
                fill="none"
                opacity="0"
                d="M292 104 C300 112 314 112 322 104"
              />
            </g>
            <g id="brow">
              <path
                id="brow_shape"
                fill="#17110D"
                stroke="none"
                d="M287 80 C295 69 316 67 327 73 C330 77 327 82 323 81 C313 76 299 77 291 84 C288 87 285 84 287 80 Z"
              />
            </g>
          </g>

          <g id="pivotdots" stroke="none">
            <circle className="pivot" cx="256" cy="150" r="5" />
            <circle className="pivot" cx="238" cy="206" r="5" />
            <circle className="pivot" cx="185" cy="230" r="5" />
            <circle className="pivot" cx="240" cy="206" r="5" />
            <circle className="pivot" cx="170" cy="218" r="5" />
            <circle className="pivot" cx="222" cy="278" r="5" />
            <circle className="pivot" cx="172" cy="272" r="5" />
            <circle className="pivot" cx="348" cy="116" r="5" />
            <circle className="pivot" cx="306" cy="88" r="5" />
          </g>
        </g>
      </svg>
    </div>
  );
}
