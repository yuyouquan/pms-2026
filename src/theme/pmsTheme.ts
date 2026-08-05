import type { ThemeConfig } from 'antd'

export const PMS_COLORS = {
  brandStrong: '#5D49F6',
  brandMain: '#7562FF',
  brandSoft: '#AD98EE',
  brandSurface: '#F5F3FF',
  brandBorder: '#DCD6FF',
  page: '#F4F6FB',
  textPrimary: '#27243A',
  textSecondary: '#625D70',
  textTertiary: '#817B90',
  border: '#E6E3EF',
} as const

export const pmsTheme: ThemeConfig = {
  token: {
    colorPrimary: PMS_COLORS.brandMain,
    colorInfo: PMS_COLORS.brandMain,
    colorBgBase: '#FFFFFF',
    colorBgLayout: PMS_COLORS.page,
    colorText: PMS_COLORS.textPrimary,
    colorTextSecondary: PMS_COLORS.textSecondary,
    colorTextTertiary: PMS_COLORS.textTertiary,
    colorBorder: PMS_COLORS.border,
    colorBorderSecondary: '#EFEDF4',
    borderRadius: 8,
    borderRadiusLG: 12,
    controlHeight: 32,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  components: {
    Button: {
      borderRadius: 8,
      primaryShadow: '0 5px 14px rgba(96, 76, 226, .22)',
    },
    Card: {
      borderRadiusLG: 12,
    },
    Modal: {
      borderRadiusLG: 16,
    },
    Table: {
      headerBg: PMS_COLORS.brandSurface,
      headerColor: '#514A70',
      rowHoverBg: '#FAF9FF',
    },
    Tabs: {
      inkBarColor: PMS_COLORS.brandMain,
      itemSelectedColor: PMS_COLORS.brandStrong,
    },
  },
}
