import type { SVGProps } from 'react'

// Набор простых иконок для блоков/инструментов (без внешних зависимостей).
export type IconName = 'map' | 'calc' | 'report' | 'api' | 'bot' | 'spark'

const paths: Record<IconName, string> = {
  map: 'M9 6l-6 3v9l6-3 6 3 6-3V6l-6 3-6-3z M9 6v9 M15 9v9',
  calc: 'M6 3h12v18H6z M9 7h6 M8 11h0 M12 11h0 M16 11h0 M8 15h0 M12 15h0 M16 15h4',
  report: 'M7 3h7l5 5v13H7z M14 3v5h5 M9 13h6 M9 17h6',
  api: 'M8 7l-5 5 5 5 M16 7l5 5-5 5 M13 4l-2 16',
  bot: 'M12 3v3 M7 8h10a2 2 0 012 2v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7a2 2 0 012-2z M9 13h0 M15 13h0',
  spark: 'M12 3l2.2 6.2L20 11l-5.8 1.8L12 19l-2.2-6.2L4 11l5.8-1.8z',
}

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name].split(' M').map((seg, i) => (
        <path key={i} d={(i === 0 ? seg : `M${seg}`).trim()} />
      ))}
    </svg>
  )
}
