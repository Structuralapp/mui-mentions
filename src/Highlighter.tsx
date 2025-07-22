import { Box, Portal } from '@mui/material';
import React, { ReactNode } from 'react';
import Mention from './Mention';
import { BaseSuggestionData, DefaultTrigger, SuggestionDataSource } from './types';
import { getPlainText, iterateMentionsMarkup } from './utils/utils';

interface HighlighterProps<T extends BaseSuggestionData> {
    /** Ref applied to the main container of the highlighter. */
    highlighterRef: React.RefObject<HTMLDivElement>;

    /** Ref applied to the element which keeps track of the cursor position. */
    cursorRef: React.RefObject<HTMLSpanElement>;

    /** Ref of the input field. */
    inputRef: HTMLInputElement | HTMLTextAreaElement | null;

    /** The start of the selected text range in the plain text value. */
    selectionStart: number | null;

    /** The end of the selected text range in the plain text value. */
    selectionEnd: number | null;

    /** The markup value string. */
    value: string;

    /** The suggestion data sources used in the makup string. */
    dataSources: SuggestionDataSource<T>[];

    /** Whether the input is multiline. */
    multiline?: boolean;

    /** The color of the highlight. */
    color?: string;

    /** Whether to use text color highlighting instead of background color. */
    highlightTextColor?: boolean;

    /** Whether to show trigger character in displayed mention text. */
    showTriggerInDisplay?: boolean;
}

function Highlighter<T extends BaseSuggestionData>(props: HighlighterProps<T>): ReactNode {
    const {
        highlighterRef,
        cursorRef,
        selectionEnd,
        selectionStart,
        value,
        dataSources,
        multiline,
        highlightTextColor,
        showTriggerInDisplay,
    } = props;
    const components: JSX.Element[] = [];

    // Convert selection coordinates to the coordinate system used by iterateMentionsMarkup
    // When showTriggerInDisplay is true, selectionStart/End are in "with triggers" coordinates
    // but iterateMentionsMarkup works in "without triggers" coordinates
    let adjustedSelectionStart = selectionStart;
    let adjustedSelectionEnd = selectionEnd;

    if (showTriggerInDisplay && selectionStart !== null && selectionEnd !== null) {
        const displayedText = getPlainText(value, dataSources, multiline, true);
        const internalText = getPlainText(value, dataSources, multiline, false);

        // Debug logging
        console.log('🔽 HIGHLIGHTER displayedText:', JSON.stringify(displayedText));
        console.log('🔽 HIGHLIGHTER internalText:', JSON.stringify(internalText));
        console.log('🔽 Original selectionStart/End:', selectionStart, selectionEnd);

        // Convert selectionStart
        let displayPos = 0;
        let internalPos = 0;
        while (displayPos < selectionStart && displayPos < displayedText.length && internalPos < internalText.length) {
            if (displayedText[displayPos] === internalText[internalPos]) {
                displayPos++;
                internalPos++;
            } else {
                displayPos++; // Skip trigger character in display
            }
        }
        adjustedSelectionStart = internalPos;

        // Convert selectionEnd
        displayPos = 0;
        internalPos = 0;
        while (displayPos < selectionEnd && displayPos < displayedText.length && internalPos < internalText.length) {
            if (displayedText[displayPos] === internalText[internalPos]) {
                displayPos++;
                internalPos++;
            } else {
                displayPos++; // Skip trigger character in display
            }
        }
        adjustedSelectionEnd = internalPos;

        console.log('🔽 Adjusted selectionStart/End:', adjustedSelectionStart, adjustedSelectionEnd);
    }

    // console.log('showTriggerInDisplay', showTriggerInDisplay);
    // console.log('dataSources', dataSources[0].trigger);
    // console.log('DefaultTrigger', DefaultTrigger);
    // console.log('dataSources[0].trigger || DefaultTrigger', dataSources[0].trigger || DefaultTrigger);
    // console.log('display', display);

    const handleMention = (
        _markup: string,
        index: number,
        _plainTextIndex: number,
        id: string,
        display: string,
        mentionIndex: number,
    ) => {
        const finalDisplay = showTriggerInDisplay
            ? (dataSources[mentionIndex].trigger || DefaultTrigger) + display
            : display;
        console.log('🔽 MENTION:', JSON.stringify(finalDisplay), 'at plainTextIndex:', _plainTextIndex);

        components.push(<Mention key={`${id}-${index}`} display={finalDisplay} color={props.color} />);
    };

    const handlePlainText = (text: string, index: number, indexInPlaintext: number) => {
        if (!multiline) {
            text = text.replaceAll('\n', '');
        }

        console.log('🔽 PLAIN TEXT:', JSON.stringify(text), 'at indexInPlaintext:', indexInPlaintext);

        const renderCursor =
            adjustedSelectionStart &&
            adjustedSelectionStart === adjustedSelectionEnd &&
            adjustedSelectionStart >= indexInPlaintext &&
            adjustedSelectionStart <= indexInPlaintext + text.length;

        console.log(
            '🔽 CURSOR CHECK: renderCursor =',
            renderCursor,
            'adjustedSelectionStart =',
            adjustedSelectionStart,
        );

        if (!renderCursor) {
            components.push(
                <Box
                    key={`${index}-${indexInPlaintext}`}
                    component='span'
                    visibility={highlightTextColor ? 'visible' : 'hidden'}
                >
                    {text}
                </Box>,
            );
        } else {
            const splitIndex = (adjustedSelectionStart || 0) - indexInPlaintext;
            const startText = text.substring(0, splitIndex);
            const endText = text.substring(splitIndex);

            if (startText) {
                components.push(
                    <Box
                        key={`${index}-${indexInPlaintext}-precursor`}
                        component='span'
                        visibility={highlightTextColor ? 'visible' : 'hidden'}
                    >
                        {startText}
                    </Box>,
                );
            }

            components.push(<Box key='cursor' ref={cursorRef} component='span' visibility='hidden'></Box>);

            if (endText) {
                components.push(
                    <Box
                        key={`${index}-${indexInPlaintext}-postcursor`}
                        component='span'
                        visibility={highlightTextColor ? 'visible' : 'hidden'}
                    >
                        {endText}
                    </Box>,
                );
            }
        }
    };

    iterateMentionsMarkup(value, dataSources, handleMention, handlePlainText, multiline);

    const rect = getHighlighterRect(props.inputRef);

    return (
        <Portal container={() => props.inputRef?.parentElement || null}>
            <Box
                ref={highlighterRef}
                sx={{
                    position: 'absolute',
                    top: `${rect.y}px`,
                    left: `${rect.x}px`,
                    width: `${rect.width}px`,
                    height: `${rect.height}px`,
                    whiteSpace: multiline ? 'pre-wrap' : 'pre',
                    overflow: 'hidden',
                    overscrollBehavior: 'none',
                    zIndex: -1,
                }}
            >
                {components}
                <Box component='span' visibility='hidden'>
                    {' '}
                </Box>
            </Box>
        </Portal>
    );
}

export default Highlighter;

/**
 * Gets the highlighter rectangle (x, y, width, height) for the provided input element.
 * @param input The input element to overlay.
 * @returns The highlighter rectangle.
 */
function getHighlighterRect(input?: HTMLInputElement | HTMLTextAreaElement | null) {
    const rec = { x: 0, y: 0, width: 0, height: 0 };
    if (!input) {
        return rec;
    }

    const computedStyle = getComputedStyle(input);
    rec.width = input.clientWidth;
    rec.width -= parseFloat(computedStyle.paddingLeft);
    rec.width -= parseFloat(computedStyle.paddingRight);
    rec.height = input.clientHeight;
    rec.height -= parseFloat(computedStyle.paddingTop);
    rec.height -= parseFloat(computedStyle.paddingBottom);

    rec.x = input.offsetLeft;
    rec.x += parseFloat(computedStyle.paddingLeft);
    rec.x += parseFloat(computedStyle.borderLeft);
    rec.y = input.offsetTop;
    rec.y += parseFloat(computedStyle.paddingTop);
    rec.y += parseFloat(computedStyle.borderTop);

    return rec;
}
