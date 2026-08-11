"use client";

import { Button, Input } from "@batthewz/response-ui-react-components";
import { type RefObject, useId, useMemo, useState } from "react";

import {
  formatOklch,
  groupThemeTokens,
  isColorValue,
  liveThemeValue,
  parseOklch,
  type ThemeToken,
} from "./theme-contract";

/**
 * The document's own `themeOverrides`, chosen from the theme contract.
 *
 * This is the claim the package makes about theming, in the form a consumer
 * would actually write it: the document names design tokens and the view
 * repaints, with no rebuild and no component touched. So the panel offers
 * exactly the tokens the contract defines — a picker with a token the design
 * system does not read would be a control that does nothing — and it writes
 * them into the JSON where they can be read next to the view they change.
 */

type ThemePanelProps = {
  tokens: readonly ThemeToken[];
  overrides: Readonly<Record<string, string>>;
  /** The rendered view, so a token opens on what the canvas is painted with. */
  viewRef?: RefObject<HTMLElement | null>;
  onChange: (token: string, value: string | undefined) => void;
};

export function BuilderTheme({ tokens, overrides, viewRef, onChange }: ThemePanelProps) {
  const [query, setQuery] = useState("");

  const active = useMemo(
    () => tokens.filter((token) => Object.hasOwn(overrides, token.name)),
    [tokens, overrides],
  );

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = tokens.filter(
      (token) =>
        !Object.hasOwn(overrides, token.name) &&
        (needle === "" || token.name.toLowerCase().includes(needle)),
    );
    return groupThemeTokens(matching);
  }, [tokens, overrides, query]);

  return (
    <div className="rui-builder-theme">
      <p className="rui-builder-note">
        Every value here is a design token, applied to this view only. Nothing is rebuilt and no
        component is touched — the document carries the theme with it.
      </p>

      {active.length > 0 && (
        <section className="rui-builder-group">
          <h4 className="rui-builder-group-title">
            In this document ({active.length})
          </h4>
          {active.map((token) => (
            <TokenRow key={token.name} token={token} value={overrides[token.name]} onChange={onChange} />
          ))}
        </section>
      )}

      <div className="rui-builder-search">
        <input
          type="search"
          className="rui-builder-input"
          value={query}
          placeholder="Search tokens"
          aria-label="Search theme tokens"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {groups.length === 0 && (
        <p className="rui-builder-empty-note">
          {query.trim() === ""
            ? "Every token in the contract is already overridden here."
            : "No token matches."}
        </p>
      )}

      {groups.map((group) => (
        <section key={group.name} className="rui-builder-group">
          <h4 className="rui-builder-group-title">{group.name}</h4>
          <div className="rui-builder-chips">
            {group.tokens.map((token) => (
              <button
                key={token.name}
                type="button"
                className="rui-builder-chip"
                title={`${token.name}: ${token.suggested}`}
                onClick={() => onChange(token.name, liveThemeValue(token, viewRef?.current))}
              >
                {isColorValue(token.suggested) && (
                  <span
                    className="rui-builder-swatch"
                    style={{ background: `var(${token.name}, ${token.suggested})` }}
                    aria-hidden="true"
                  />
                )}
                {token.name.replace(/^--/, "")}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TokenRow({
  token,
  value,
  onChange,
}: {
  token: ThemeToken;
  value: string;
  onChange: (token: string, value: string | undefined) => void;
}) {
  const id = useId();
  const oklch = parseOklch(value);

  return (
    <div className="rui-builder-token">
      <div className="rui-builder-token-head">
        {isColorValue(value) && (
          <span className="rui-builder-swatch" style={{ background: value }} aria-hidden="true" />
        )}
        <label className="rui-builder-label" htmlFor={id}>
          {token.name}
        </label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChange(token.name, undefined)}
        >
          Remove
        </Button>
      </div>

      <Input
        id={id}
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(token.name, event.target.value)}
      />

      {oklch !== null && (
        <div className="rui-builder-channels">
          <Channel
            label="L"
            min={0}
            max={1}
            step={0.005}
            value={oklch.l}
            onChange={(l) => onChange(token.name, formatOklch({ ...oklch, l }))}
          />
          <Channel
            label="C"
            min={0}
            max={0.4}
            step={0.005}
            value={oklch.c}
            onChange={(c) => onChange(token.name, formatOklch({ ...oklch, c }))}
          />
          <Channel
            label="H"
            min={0}
            max={360}
            step={1}
            value={oklch.h}
            onChange={(h) => onChange(token.name, formatOklch({ ...oklch, h }))}
          />
        </div>
      )}

      {token.responsive && (
        <p className="rui-builder-hint">
          This token steps up at the 40rem breakpoint. An override is a flat value, so it applies at
          every width and the step is lost.
        </p>
      )}

      {oklch === null && isColorValue(value) && (
        <p className="rui-builder-hint">
          Not an <code>oklch()</code> value, so there are no channels to move. The design system is
          authored in OKLCH — {token.suggested} is what this token started as.
        </p>
      )}

      {!isColorValue(value) && <p className="rui-builder-hint">Suggested: {token.suggested}</p>}
    </div>
  );
}

function Channel({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="rui-builder-channel">
      <label className="rui-builder-channel-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="range"
        className="rui-builder-range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output className="rui-builder-channel-value">{Number(value.toFixed(3))}</output>
    </div>
  );
}
