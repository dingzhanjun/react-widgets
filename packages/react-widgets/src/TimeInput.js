import classNames from 'classnames'
import PropTypes from 'prop-types'
import React, { useCallback, useRef, useState } from 'react'
import useUncontrollable from 'uncontrollable/hook'

import qsa from 'dom-helpers/query/querySelectorAll'

import dates from './util/dates'

import useFocusManager from './util/useFocusManager'
import { createEditableCallback } from './util/interaction'

import Button from './Button'
import Widget from './Widget'
import { times } from './Icon'

const selectTextRange = el => {
  if (el.select) return el.select()
  var range = document.createRange()
  range.selectNodeContents(el)
  window.getSelection().removeAllRanges()
  window.getSelection().addRange(range)
}
const padStart = (str, len, pad) => {
  str = String(str == null ? '' : str)
  while (str.length < len) str = pad + str
  return str
}

// prettier-ignore
const isEmptyValue = (p, precision) =>
  p.hours == null &&
  p.minutes == null &&
  ((precision != 'seconds' && precision !== 'milliseconds') || p.seconds == null) &&
  (precision !== 'milliseconds' || p.milliseconds == null);

// prettier-ignore
const isPartialValue = (p, precision) =>
  p.hours == null ||
  p.minutes == null ||
  ((precision === 'seconds' || precision === 'milliseconds') && p.seconds == null) ||
  ( precision === 'milliseconds' && p.milliseconds == null);

const getValueParts = (value, use12HourClock) => {
  let hours, minutes, seconds, milliseconds
  let meridiem = 'AM'

  if (value) {
    hours = value.getHours()
    if (use12HourClock) {
      meridiem = hours < 12 ? 'AM' : 'PM'
      hours = hours % 12 || 12
    }

    minutes = value.getMinutes()
    seconds = value.getSeconds()
    milliseconds = value.getMilliseconds()
  }

  return { hours, minutes, seconds, milliseconds, meridiem }
}

const TESTS = {
  hours: /^([1]?[0-9]|2[0-3])$/,
  hours12: /^^(1[0-2]|0?[1-9])$$/,
  minutes: /^([0-5]?\d)$/,
  seconds: /^([0-5]?\d)$/,
  milliseconds: /^(\d{1,3})$/,
}

const isValid = (value, part, use12HourClock) => {
  if (part === 'hours') part = !use12HourClock ? 'hours' : 'hours12'
  return TESTS[part].test(value)
}

/* eslint-disable react/prop-types */
const TimePartInput = ({
  value,
  pad,
  innerRef,
  placeholder,
  min,
  max,
  emptyChar,
  ...props
}) => (
  <input
    {...props}
    ref={innerRef}
    data-focusable
    autoComplete="off"
    role="spinbutton"
    aria-valuenow={value}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuetext={value == null ? '' : value}
    // seems readonly is not valid
    aria-disabled={props.disabled || props.readOnly}
    placeholder={placeholder}
    className="rw-input-reset rw-time-part-input"
    value={
      placeholder && !value
        ? ''
        : padStart(value, pad || 0, value == null ? emptyChar : '0')
    }
  />
)
/* eslint-enable react/prop-types */

const propTypes = {
  value: PropTypes.instanceOf(Date),
  onChange: PropTypes.func,

  /**
   * The default date used to construct a new time when the `value` is empty
   *
   * @default new Date()
   **/
  datePart: PropTypes.instanceOf(Date),

  /**
   * Use a 12 hour clock (with AM/PM) instead of 24 hour one.
   * The configured localizer may provide a default value .
   **/
  use12HourClock: PropTypes.bool,

  /** Time part values will be padded by `0` */
  padValues: PropTypes.bool,

  /** The string character used to pad empty, or cleared values */
  emptyCharacter: PropTypes.string,

  /** Hide the input clear button */
  noClearButton: PropTypes.bool,

  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,

  /** Controls how precise of a time can be input **/
  precision: PropTypes.oneOf(['minutes', 'seconds', 'milliseconds']).isRequired,

  /**
   * The seperator between hours and minutes
   * @default ':'
   */
  hoursAddon: PropTypes.node,

  /**
   * The seperator between hours and minutes
   * @default ':'
   */
  minutesAddon: PropTypes.node,

  /**
   * The seperator between hours and minutes
   * @default ':'
   */
  secondsAddon: PropTypes.node,

  /**
   * The seperator between hours and minutes
   * @default '.'
   */
  millisecondsAddon: PropTypes.node,
}

const defaultProps = {
  hoursAddon: ':',
  padValues: true,
  precision: 'minutes',
  emptyCharacter: '-',
}

let count = 0
function useTimePartState(value, use12HourClock) {
  const [state, setState] = useState(() => ({
    value,
    use12HourClock,
    timeParts: getValueParts(value, use12HourClock),
  }))

  const setTimeParts = useCallback(
    timeParts => setState(s => ({ ...s, timeParts })),
    [setState],
  )

  if (state.value !== value || state.use12HourClock !== use12HourClock) {
    count++
    if (count < 100)
      setState({
        value,
        use12HourClock,
        timeParts: getValueParts(value, use12HourClock),
      })
  }

  return [state.timeParts, setTimeParts]
}

function TimeInput(uncontrolledProps) {
  const {
    value,
    use12HourClock,
    padValues: pad,
    emptyCharacter,
    precision,
    noClearButton,
    hoursAddon,
    minutesAddon = precision === 'seconds' || precision === 'milliseconds'
      ? ':'
      : '',
    secondsAddon = precision === 'milliseconds' ? '.' : '',
    millisecondsAddon,
    className,
    disabled,
    readOnly,
    datePart,
    onChange,
    ...props
  } = useUncontrollable(uncontrolledProps, { value: 'onChange' })

  const ref = useRef()
  const hourRef = useRef()

  const [focusEvents, focused] = useFocusManager(ref, {
    didHandle: (focused, e) => {
      if (!focused) return
      if (!e.target.dataset.focusable) hourRef.current?.focus()
      else select(e.target)
    },
  })

  const [timeParts, setTimeParts] = useTimePartState(value, use12HourClock)

  function getDatePart() {
    return dates.startOf(datePart || dates.today(), 'day')
  }

  const getMin = part => (part === 'hours' ? 1 : 0)

  const getMax = part => {
    if (part === 'hours') return use12HourClock ? 12 : 23
    if (part === 'milliseconds') return 999
    return 59
  }

  function select(target = document.activeElement) {
    window.Promise.resolve().then(() => {
      if (focused) selectTextRange(target)
    })
  }

  /**
   * Handlers
   */

  const useEditableCallback = createEditableCallback(disabled || readOnly, ref)

  const handleClear = useEditableCallback(() => {
    hourRef.current?.focus()

    if (value) onChange(null)
    else setTimeParts(getValueParts(null))
  })

  const handleChange = (part, event) => {
    const currentValue = timeParts[part]

    const { target } = event
    const rawValue = target.value
    const strValue = `${currentValue || ''}${rawValue}`
    let numValue = +strValue

    select(target)

    if (
      isNaN(numValue) ||
      (strValue && !isValid(strValue, part, use12HourClock))
    ) {
      // the combined value is now past the max or invalid so try the single
      // digit and "start over" filling the value
      if (isValid(rawValue, part, use12HourClock) && !isNaN(+rawValue)) {
        numValue = +rawValue
      } else {
        return event.preventDefault()
      }
    }

    notifyChange({ [part]: target.value ? numValue : null })
  }

  const handleSelect = ({ target }) => {
    select(target)
  }

  const handleKeyDown = useEditableCallback((part, event) => {
    const { key, target: input } = event
    const { selectionStart: start, selectionEnd: end } = input

    const isMeridiem = part === 'meridiem'

    if (key === 'ArrowUp') {
      event.preventDefault()
      increment(part, 1)
    }
    if (key === 'ArrowDown') {
      event.preventDefault()
      increment(part, -1)
    }
    if (key === 'ArrowLeft' && (isMeridiem || start - 1 < 0)) {
      event.preventDefault()
      focusNext(input, -1)
    }
    if (key === 'ArrowRight' && (isMeridiem || input.value.length <= end + 1)) {
      event.preventDefault()
      focusNext(input, +1)
    }

    if (readOnly && key !== 'Tab') {
      event.preventDefault()
    }

    if (isMeridiem) {
      if (key === 'a' || key === 'A') notifyChange({ meridiem: 'AM' })
      if (key === 'p' || key === 'P') notifyChange({ meridiem: 'PM' })
    }
  })

  const increment = useEditableCallback((part, inc) => {
    let nextPart = timeParts[part]
    if (part === 'meridiem') {
      nextPart = nextPart === 'AM' ? 'PM' : 'AM'
    } else {
      nextPart = (nextPart || 0) + inc
      if (!isValid(String(nextPart), part, use12HourClock)) return
    }

    notifyChange({ [part]: nextPart })
    select()
  })

  function notifyChange(updates) {
    const nextTimeParts = { ...timeParts, ...updates }

    if (value && isEmptyValue(nextTimeParts, precision)) {
      return onChange(null)
    }

    if (isPartialValue(nextTimeParts, precision))
      return setTimeParts(nextTimeParts)

    let { hours, minutes, seconds, milliseconds, meridiem } = nextTimeParts
    let nextDate = new Date(value || getDatePart())

    if (use12HourClock) {
      if (hours === 12) hours = 0
      hours += meridiem === 'PM' ? 12 : 0
    }

    nextDate.setHours(hours)
    nextDate.setMinutes(minutes)

    if (seconds != null) nextDate.setSeconds(seconds)
    if (milliseconds != null) nextDate.setMilliseconds(milliseconds)

    onChange(nextDate, {
      lastValue: value,
      timeParts,
    })
  }

  function focusNext(input, delta) {
    let nodes = qsa(ref.current, '* [data-focusable="true"]')
    let next = nodes[nodes.indexOf(input) + delta]
    next?.focus()
    select(next)
  }

  const { hours, minutes, seconds, milliseconds, meridiem } = timeParts
  const showClear = !isEmptyValue(timeParts, precision)

  return (
    <Widget
      {...props}
      role="textbox"
      ref={ref}
      {...focusEvents}
      focused={focused}
      disabled={disabled}
      readOnly={readOnly}
      className={classNames(
        className,
        'rw-input',
        'rw-time-input',
        'rw-widget-container',
      )}
    >
      <TimePartInput
        size={2}
        pad={pad && 2}
        value={hours}
        disabled={disabled}
        readOnly={readOnly}
        aria-label="hours"
        min={getMin('hours')}
        max={getMax('hours')}
        innerRef={hourRef}
        emptyChar={emptyCharacter}
        onSelect={handleSelect}
        onChange={e => handleChange('hours', e)}
        onKeyDown={e => handleKeyDown('hours', e)}
      />

      {hoursAddon && <span>{hoursAddon}</span>}
      <TimePartInput
        size={2}
        pad={pad && 2}
        value={minutes}
        disabled={disabled}
        readOnly={readOnly}
        aria-label="minutes"
        min={getMin('minutes')}
        max={getMax('minutes')}
        emptyChar={emptyCharacter}
        onSelect={handleSelect}
        onChange={e => handleChange('minutes', e)}
        onKeyDown={e => handleKeyDown('minutes', e)}
      />

      {minutesAddon && <span>{minutesAddon}</span>}
      {(precision === 'seconds' || precision === 'milliseconds') && (
        <>
          <TimePartInput
            size={2}
            pad={pad && 2}
            value={seconds}
            disabled={disabled}
            readOnly={readOnly}
            aria-label="seconds"
            min={getMin('seconds')}
            max={getMax('seconds')}
            emptyChar={emptyCharacter}
            onSelect={handleSelect}
            onChange={e => handleChange('seconds', e)}
            onKeyDown={e => handleKeyDown('seconds', e)}
          />
          {secondsAddon && <span>{secondsAddon}</span>}
        </>
      )}
      {precision === 'milliseconds' && (
        <>
          <TimePartInput
            size={3}
            pad={pad && 3}
            value={milliseconds}
            disabled={disabled}
            readOnly={readOnly}
            aria-label="milliseconds"
            min={getMin('milliseconds')}
            max={getMax('milliseconds')}
            emptyChar={emptyCharacter}
            onSelect={handleSelect}
            onChange={e => handleChange('milliseconds', e)}
            onKeyDown={e => handleKeyDown('milliseconds', e)}
          />
          {millisecondsAddon && <span>{millisecondsAddon}</span>}
        </>
      )}
      {use12HourClock && (
        <div
          role="listbox"
          aria-label="AM/PM"
          aria-disabled={disabled}
          aria-readonly={readOnly}
          onKeyDown={e => handleKeyDown('meridiem', e)}
          className="rw-input-reset rw-time-part-meridiem"
        >
          <div
            data-focusable
            tabIndex="0"
            role="option"
            aria-atomic
            aria-selected
            aria-setsize="2"
            aria-live="assertive"
            aria-disabled={disabled}
            aria-readonly={readOnly}
            aria-posinset={meridiem === 'AM' ? 1 : 2}
            onFocus={handleSelect}
            onSelect={handleSelect}
          >
            <abbr>{meridiem}</abbr>
          </div>
        </div>
      )}
      {!noClearButton && (
        <Button
          variant={null}
          label={'clear input'}
          onClick={handleClear}
          className={classNames('rw-time-input-clear', showClear && 'rw-show')}
        >
          {times}
        </Button>
      )}
    </Widget>
  )
}

TimeInput.propTypes = propTypes
TimeInput.defaultProps = defaultProps

export default TimeInput
