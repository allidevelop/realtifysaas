import { Lora, Manrope } from 'next/font/google'

// Manrope — основной UI/тело (геометрический гротеск, полная кириллица, premium-характер,
// НЕ Inter/system). Lora — засечный дисплей для заголовков (редакционный «дорогой» тон).
export const fontSans = Manrope({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-manrope',
  display: 'swap',
})

export const fontSerif = Lora({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-lora',
  display: 'swap',
  weight: ['500', '600', '700'],
})

export const fontClass = `${fontSans.variable} ${fontSerif.variable}`
