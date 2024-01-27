/**
 * Vendored in from https://github.com/mattrothenberg/react-overflow-list
 * with some minor tweaks to reduce flickering.
 */

import React, { useCallback, useEffect } from "react";
import {
  useMeasure,
  useMount,
  usePrevious,
  useShallowCompareEffect,
  useUpdateEffect,
} from "react-use";

type CollapseDirection = "start" | "end";
type OverflowDirection = "none" | "grow" | "shrink";

export interface OverflowListProps<T> {
  items: T[];
  itemRenderer: (item: T, index: number) => React.ReactNode;
  overflowRenderer: (items: T[]) => React.ReactNode;
  minVisibleItems?: number;
  onOverflow?: (items: T[]) => void;
  collapseFrom?: CollapseDirection;
  className?: string;
  tagName?: keyof JSX.IntrinsicElements;
  alwaysRenderOverflow?: boolean;
}

interface OverflowListState<T> {
  visible: T[];
  overflow: T[];
  lastOverflowCount: number;
  overflowDirection: OverflowDirection;
  opacity: 1 | 0;
}

export function OverflowList<T>(props: OverflowListProps<T>) {
  const {
    items,
    collapseFrom = "end",
    minVisibleItems = 0,
    tagName = "div",
    className = "",
    alwaysRenderOverflow = false,
    overflowRenderer,
    itemRenderer,
  } = props;
  const [state, setState] = React.useState<OverflowListState<T>>({
    visible: items,
    overflow: [],
    lastOverflowCount: 0,
    overflowDirection: "none",
    opacity: 0,
  });

  const spacer = React.useRef<HTMLDivElement>(null);

  useShallowCompareEffect(() => {
    repartition(false);
  }, [state]);

  useMount(() => {
    repartition(false);
  });

  useUpdateEffect(() => {
    setState(() => ({
      overflowDirection: "none",
      lastOverflowCount: 0,
      overflow: [],
      visible: items,
      opacity: 0,
    }));
  }, [items]);

  const WrapperComponent = tagName;

  const maybeOverflow =
    state.overflow.length === 0 && !alwaysRenderOverflow
      ? null
      : overflowRenderer(state.overflow);

  const repartition = useCallback(
    (growing: boolean) => {
      if (!spacer.current) {
        return;
      }

      if (growing) {
        setState((state) => ({
          overflowDirection: "grow",
          lastOverflowCount:
            state.overflowDirection === "none"
              ? state.overflow.length
              : state.lastOverflowCount,
          overflow: [],
          visible: props.items,
          opacity: 0,
        }));
      } else if (spacer.current.getBoundingClientRect().width < 0.9) {
        setState((state) => {
          if (state.visible.length <= minVisibleItems!) {
            return state;
          }
          const collapseFromStart = collapseFrom === "start";
          const visible = state.visible.slice();
          const next = collapseFromStart ? visible.shift() : visible.pop();
          if (!next) {
            return state;
          }
          const overflow = collapseFromStart
            ? [...state.overflow, next]
            : [next, ...state.overflow];
          return {
            ...state,
            direction:
              state.overflowDirection === "none"
                ? "shrink"
                : state.overflowDirection,
            overflow,
            visible,
            opacity: 0,
          };
        });
      } else {
        setState((prevState) => {
          return { ...prevState, overflowDirection: "none", opacity: 1 };
        });
      }
    },
    [collapseFrom, minVisibleItems, props.items]
  );

  const [ref, { width }] = useMeasure<any>();
  const previousWidth = usePrevious(width);

  useEffect(() => {
    if (!previousWidth) return;

    repartition(width > previousWidth);
  }, [width, previousWidth]);

  return (
    <WrapperComponent
      // @ts-ignore
      ref={ref}
      className={className}
      style={{
        display: "flex",
        flexWrap: "nowrap",
        minWidth: 0,
        opacity: state.opacity,
      }}
    >
      {collapseFrom === "start" ? maybeOverflow : null}
      {state.visible.map(itemRenderer)}
      {collapseFrom === "end" ? maybeOverflow : null}
      <div style={{ flexShrink: 1, width: 1 }} ref={spacer} />
    </WrapperComponent>
  );
}
