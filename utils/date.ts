import dayjs from 'dayjs'

export function formatDate(date: string | Date, format: string) {
  return dayjs(date).format(format)
}
