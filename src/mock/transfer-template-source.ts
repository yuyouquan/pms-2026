// 用户提供的飞书 V1.0 模板，读取于 2026-09-23。仅提取 PMS 模板已有字段；不带入源表的项目交付件或自检结论。
// CheckList: wiki/Cm18w9qrfihvcgk5N9HcLoeNnnf，2GiwtP / C6sDbn，revision 550。
// 评审要素: wiki/KyAWwCD1Qids59kazovcasCqnXc，zuUP66，revision 2308。
import type { CheckListTemplate, ReviewElementTemplate } from '@/mock/transfer-maintenance'

export const TRANSFER_TEMPLATE_REVISION = 'feishu-2026-09-23'

export const WHOLE_CHECKLIST_SOURCE = [
  {
    "sourceRow": 3,
    "seq": "V-01",
    "type": "检查项",
    "checkItem": "IPM/SPUG/SCM项目信息完整无误、版本归档流程走完，SCM产品规格清单的特性状态和配置状态处理完成且完成锁定",
    "owner": "SPM"
  },
  {
    "sourceRow": 4,
    "seq": "V-02",
    "type": "检查项",
    "checkItem": "Super空间大小：规划N代升级预留N/GB大小",
    "owner": "SPM"
  },
  {
    "sourceRow": 5,
    "seq": "V-03",
    "type": "检查项",
    "checkItem": "项目计划已文控归档（交接时提供截图）",
    "owner": "SPM"
  },
  {
    "sourceRow": 6,
    "seq": "V-04",
    "type": "检查项",
    "checkItem": "交接时，所有市场项目（Product）最新归档版本的GMS包需要与市场项目的最新配置保持一致   ",
    "owner": "SPM"
  },
  {
    "sourceRow": 7,
    "seq": "V-05",
    "type": "检查项",
    "checkItem": "Jenkins 编译界面/SCM软件配置管理平台所有参数需更新到 准确，如因参数不准确导致版本编译fail，需由原SPM协调CI调整好后才可转维",
    "owner": "SPM"
  },
  {
    "sourceRow": 8,
    "seq": "V-06",
    "type": "检查项",
    "checkItem": "项目资料在固定服务器完成归档（项目计划、产品规格清单、产品价值表、出货国家、关键器件选型/功耗选型表、产品定义书、PCBA配置表等信息）",
    "owner": "SPM"
  },
  {
    "sourceRow": 9,
    "seq": "V-07",
    "type": "检查项",
    "checkItem": "项目客制化需求（多个市场名、UI/UX的定制化，如铃声壁纸等）必须在SPD中有记录",
    "owner": "SPM"
  },
  {
    "sourceRow": 10,
    "seq": "V-08",
    "type": "检查项",
    "checkItem": "确认OTA 首版到最新量升版本中间无断开，如有断开，备注中说明原因",
    "owner": "测试,SPM"
  },
  {
    "sourceRow": 11,
    "seq": "V-09",
    "type": "检查项",
    "checkItem": "确认历史版本是否全市场推送，如有特殊市场未推OTA，备注中说明原因",
    "owner": "测试,SPM"
  },
  {
    "sourceRow": 12,
    "seq": "V-10",
    "type": "交接资料",
    "checkItem": "1.硬件散热方案;\n2.限流参数;\n3.CPU thermal参数;\n4.其他关于温升的特殊软件策略;",
    "owner": "底软"
  },
  {
    "sourceRow": 13,
    "seq": "V-11",
    "type": "交接资料",
    "checkItem": "静态模型指标达标\n动态模型指标达标\n主观模型指标达标\n连续启动退出模型指标达标",
    "owner": "系统"
  },
  {
    "sourceRow": 14,
    "seq": "V-12",
    "type": "交接资料",
    "checkItem": "提供最新版本的动态模型数据，对比标准衰退block转维\n\n对应项目的模型差距拆解报告(例：15.1.0 性能测试模型指标差距分析)",
    "owner": "系统"
  },
  {
    "sourceRow": 15,
    "seq": "V-13",
    "type": "交接资料",
    "checkItem": "(通常基线首项目&重点项目才会做流畅性模型测试，未测的项目不需要提供.\n测试侧：对应项目的流畅性专项报告(例：tOS15.1.0 T615-Slim平台流畅性专项报告 - Apr1st)",
    "owner": "测试"
  },
  {
    "sourceRow": 16,
    "seq": "V-14",
    "type": "交接资料",
    "checkItem": "1、续航测试报告\n2、软件基础功耗测试报告\n3、温升测试报告\n4、最新版本游戏测试数据",
    "owner": "测试"
  },
  {
    "sourceRow": 17,
    "seq": "V-15",
    "type": "交接资料",
    "checkItem": "列出MADA市场及其余市场版本维护规则",
    "owner": "SPM"
  },
  {
    "sourceRow": 18,
    "seq": "V-16",
    "type": "交接资料",
    "checkItem": "如果上个版本是SMR版本，提供Base OS version版本路径",
    "owner": "SPM"
  },
  {
    "sourceRow": 19,
    "seq": "V-17",
    "type": "交接资料",
    "checkItem": "样机交接表",
    "owner": "测试,底软,系统"
  },
  {
    "sourceRow": 20,
    "seq": "V-18",
    "type": "交接资料",
    "checkItem": "提供项目相关最新说明书及认证资料路径",
    "owner": "测试"
  },
  {
    "sourceRow": 21,
    "seq": "V-19",
    "type": "交接资料",
    "checkItem": "提供硬件转维交接资料checklist表格",
    "owner": "测试"
  },
  {
    "sourceRow": 22,
    "seq": "V-20",
    "type": "交接资料",
    "checkItem": "项目导入的所有多供信息（TP/LCM/memory/CAM/充电器等）",
    "owner": "SPM"
  },
  {
    "sourceRow": 23,
    "seq": "V-21",
    "type": "交接资料",
    "checkItem": "《XX项目-版本开放记录》",
    "owner": "SPM"
  },
  {
    "sourceRow": 24,
    "seq": "V-22",
    "type": "交接资料",
    "checkItem": "《XX项目-必解问题清单》",
    "owner": "SPM"
  },
  {
    "sourceRow": 25,
    "seq": "V-23",
    "type": "交接资料",
    "checkItem": "《XX项目-NPS调研任务分解报告》",
    "owner": "SPM"
  },
  {
    "sourceRow": 26,
    "seq": "V-24",
    "type": "交接资料",
    "checkItem": "《XX项目-产品PD》",
    "owner": "SPM"
  },
  {
    "sourceRow": 27,
    "seq": "V-25",
    "type": "交接资料",
    "checkItem": "《XX项目-风险评估报告》",
    "owner": "SPM"
  },
  {
    "sourceRow": 28,
    "seq": "V-26",
    "type": "交接资料",
    "checkItem": "《XX项目-SMRD》",
    "owner": "SPM"
  },
  {
    "sourceRow": 29,
    "seq": "V-27",
    "type": "交接资料",
    "checkItem": "《XX项目-产品需求及分解表》",
    "owner": "SPM"
  },
  {
    "sourceRow": 30,
    "seq": "V-28",
    "type": "交接资料",
    "checkItem": "《XX项目-状态表链接》",
    "owner": "SPM"
  },
  {
    "sourceRow": 31,
    "seq": "V-29",
    "type": "交接资料",
    "checkItem": "《XX项目-出货国家列表》",
    "owner": "SPM"
  },
  {
    "sourceRow": 32,
    "seq": "V-30",
    "type": "交接资料",
    "checkItem": "《XX项目-关键器件表》/系统链接",
    "owner": "SPM"
  },
  {
    "sourceRow": 33,
    "seq": "V-31",
    "type": "交接资料",
    "checkItem": "《XX项目-多供导入计划》",
    "owner": "SPM"
  },
  {
    "sourceRow": 34,
    "seq": "V-32",
    "type": "交接资料",
    "checkItem": "《XX项目-PCBA配置表》",
    "owner": "SPM"
  },
  {
    "sourceRow": 35,
    "seq": "V-33",
    "type": "交接资料",
    "checkItem": "《XX项目-SPD》",
    "owner": "SPM"
  },
  {
    "sourceRow": 36,
    "seq": "V-34",
    "type": "交接资料",
    "checkItem": "《XX项目-功耗评估报告》",
    "owner": "底软"
  },
  {
    "sourceRow": 37,
    "seq": "V-35",
    "type": "交接资料",
    "checkItem": "《XX项目-温升方案checklist》",
    "owner": "底软"
  },
  {
    "sourceRow": 38,
    "seq": "V-36",
    "type": "交接资料",
    "checkItem": "《XX项目-KO前风险识别Checklist》",
    "owner": "底软"
  },
  {
    "sourceRow": 39,
    "seq": "V-37",
    "type": "交接资料",
    "checkItem": "《XX项目-BSP_GPIO_checklist》",
    "owner": "底软"
  },
  {
    "sourceRow": 40,
    "seq": "V-38",
    "type": "交接资料",
    "checkItem": "《XX项目-Modem_GPIO_checklist》",
    "owner": "底软"
  },
  {
    "sourceRow": 41,
    "seq": "V-39",
    "type": "交接资料",
    "checkItem": "《XX项目-PD checklist》",
    "owner": "底软"
  },
  {
    "sourceRow": 42,
    "seq": "V-40",
    "type": "交接资料",
    "checkItem": "《XX项目-驱动checklist》",
    "owner": "底软"
  },
  {
    "sourceRow": 43,
    "seq": "V-41",
    "type": "交接资料",
    "checkItem": "《XX项目-功耗大数据不达标澄清报告》",
    "owner": "底软"
  },
  {
    "sourceRow": 44,
    "seq": "V-42",
    "type": "交接资料",
    "checkItem": "《XX项目-硬件报告归档路径》\n《XX项目-软件报告归档路径》",
    "owner": "测试"
  },
  {
    "sourceRow": 45,
    "seq": "V-43",
    "type": "交接资料",
    "checkItem": "《XX项目-功耗续航测试数据》",
    "owner": "测试"
  },
  {
    "sourceRow": 46,
    "seq": "V-44",
    "type": "交接资料",
    "checkItem": "《XX项目-价值点验收》",
    "owner": "测试"
  },
  {
    "sourceRow": 47,
    "seq": "V-45",
    "type": "检查项",
    "checkItem": "转维时明确下一版本是否有特殊修改点需要测试验证的",
    "owner": "开发"
  },
  {
    "sourceRow": 48,
    "seq": "V-46",
    "type": "检查项",
    "checkItem": "满足所有准入条件后，转维交接表，再邮件通知PDT-list变更",
    "owner": "SPM"
  }
]

export const TOS_CHECKLIST_SOURCE = [
  {
    "sourceRow": 3,
    "seq": "V-01",
    "type": "检查项",
    "checkItem": "内研（整机全部转维）外研（STR5全部通过）",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 4,
    "seq": "V-02",
    "type": "检查项",
    "checkItem": "tOS版本计划已文控归档（交接时提供截图）",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 5,
    "seq": "V-03",
    "type": "检查项",
    "checkItem": "tOS版本所有SR完成交付；所有IR和价值需求完成验收",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 6,
    "seq": "V-04",
    "type": "检查项",
    "checkItem": "tOS版本资料在固定服务器完成归档（tOS版本计划、产品价值表等信息）",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 7,
    "seq": "V-05",
    "type": "检查项",
    "checkItem": "所有需求（多个市场名、UI/UX的定制化，如铃声壁纸等）必须在SPD中有记录",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 8,
    "seq": "V-06",
    "type": "检查项",
    "checkItem": "1.转维时进行中的1+N版本火车由tOS SPM跟进到版本外发完成\n2.已规划完成后续两次的1+N版本火车计划",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 9,
    "seq": "V-07",
    "type": "检查项",
    "checkItem": "tOS 版本已按安全patch策略合入最新月份1号patch",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 10,
    "seq": "V-08",
    "type": "检查项",
    "checkItem": "上一个基础体验无Block版本问题",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 11,
    "seq": "V-09",
    "type": "交接资料",
    "checkItem": "《tOSxx 需求&修改点收集》",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 12,
    "seq": "V-10",
    "type": "交接资料",
    "checkItem": "【tOSxx】1+N版本火车测试内部运行规则",
    "owner": "tOS TPM"
  },
  {
    "sourceRow": 13,
    "seq": "V-11",
    "type": "交接资料",
    "checkItem": "【tOSxx】1+N版本火车测试策略",
    "owner": "tOS TPM"
  },
  {
    "sourceRow": 14,
    "seq": "V-12",
    "type": "交接资料",
    "checkItem": "【tOSxx】1+N版本火车-基础体验项目选取规则",
    "owner": "tOS TPM"
  },
  {
    "sourceRow": 15,
    "seq": "V-13",
    "type": "交接资料",
    "checkItem": "《tOSxx 版本&整机MR版本计划》",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 16,
    "seq": "V-14",
    "type": "交接资料",
    "checkItem": "《tOSxx 1+N版本外发评审》",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 17,
    "seq": "V-15",
    "type": "交接资料",
    "checkItem": "《tOSxx MP分支需求》",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 18,
    "seq": "V-16",
    "type": "交接资料",
    "checkItem": "《tOSxx 收编管理书》",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 19,
    "seq": "V-17",
    "type": "交接资料",
    "checkItem": "《tOSxx 项目风险跟踪表》",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 20,
    "seq": "V-18",
    "type": "交接资料",
    "checkItem": "《tOSxx 项目需求管理书》",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 21,
    "seq": "V-19",
    "type": "交接资料",
    "checkItem": "《tOSxx 版本粉丝运营》",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 22,
    "seq": "V-20",
    "type": "交接资料",
    "checkItem": "《tOSxx 项目质量管理表》",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 23,
    "seq": "V-21",
    "type": "交接资料",
    "checkItem": "《tOSxx 量产分支管理》 ",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 24,
    "seq": "V-22",
    "type": "交接资料",
    "checkItem": "《tOSxx 基础体验测试结果》",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 25,
    "seq": "V-23",
    "type": "交接资料",
    "checkItem": "《tOSxx STR节点各阶段的评审报告》",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 26,
    "seq": "V-24",
    "type": "检查项",
    "checkItem": "转维评审通过后当天完成所有维护领域权限修改（系统、群组、文档等）",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 27,
    "seq": "V-25",
    "type": "检查项",
    "checkItem": "转维时明确下一版本是否有特殊修改点需要测试验证",
    "owner": "tOS SPM"
  },
  {
    "sourceRow": 28,
    "seq": "V-26",
    "type": "检查项",
    "checkItem": "满足所有准入条件后，转维交接表，再邮件通知PDT-list变更",
    "owner": "tOS SPM"
  }
]

export const WHOLE_REVIEW_SOURCE = [
  {
    "sourceRow": 3,
    "seq": "V-01",
    "type": "准入条件",
    "standard": "1. 项目库/tOS库（Affect Project=项目）/Monkey库/海外库/粉丝库的MP block、MR block、blocker问题、必解问题=0\n2.B、C类待验证问题清零\n",
    "description": "遗留问题：\n1. 转维前超过一周的必解问题：必须闭环清零（close状态）。不影响版本外发且短期无法闭环的问题.如果有明确解决计划.可以由原owner跟踪闭环.不影响转维。\n2. 转维前一周内新增的必解问题：原owner继续跟踪解决.但不影响转维。\n3. 转维前的非必解问题（随主干解决、下个tOS版本解决）：原owner继续跟踪。后续若该类问题升级为必解问题.维护部门负责解决。\n4. 已知机动场测问题（机动场测问题需要在机动场测人员离开前解决）=0\n5. 谷歌pip（performance improve program）问题=0",
    "remark": "project IN (X6873-H972, tOS15.1.0) AND issuetype = Bug AND resolution is empty AND \"Affect Project\" = X6873-H972  AND (priority = Blocker OR Tag  IN (\"MP Block\", \"MR1 Block\", \"MR Block\", \"量升必解\", \"MR2必解\", \"MR3必解\") OR \"Must Resolve\" = \"MP Block\") AND created < \"-7d\"\n\nproject IN (X6873-H972-AeeExpAuto) AND issuetype = Bug AND resolution is empty AND \"Affect Project\" = X6873-H972  AND (priority = Blocker OR Tag  IN (\"MP Block\", \"MR1 Block\", \"MR Block\", \"量升必解\", \"MR2必解\", \"MR3必解\") OR \"Must Resolve\" = \"MP Block\") AND created < \"-7d\"",
    "owner": "SPM"
  },
  {
    "sourceRow": 4,
    "seq": "V-02",
    "type": "准入条件",
    "standard": "BTS warning问题=0",
    "description": "已知BTS warning清零。Warning转Fail时间超过一个月的可评估。",
    "remark": "",
    "owner": "SPM"
  },
  {
    "sourceRow": 5,
    "seq": "V-03",
    "type": "准入条件",
    "standard": "共性问题=0",
    "description": "共性问题导入完成.非顺切问题需更新版本释放后才可交接。",
    "remark": "共性问题拦截系统=拦截外发",
    "owner": "SPM"
  },
  {
    "sourceRow": 6,
    "seq": "V-04",
    "type": "准入条件",
    "standard": "十万火急问题=0",
    "description": "售后问题（海外站点&市场异常处理平台）：\n①项目十万火急问题和共性十万火急问题不允许转维；\n②售后问题责任团队以转维成功邮件时间点为准切换责任团队；\n③转维评审前不允许出现open状态超期的软工问题遗留；\n④转维前未超期的软工问题由在研团队跟踪至非open状态（时效性：两周）\n⑤转维前的Fix售后问题逆向复盘由在研测试团队负责",
    "remark": "",
    "owner": "SPM"
  },
  {
    "sourceRow": 7,
    "seq": "V-05",
    "type": "准入条件",
    "standard": "modem子系统                                   Transsion标准 & 放行标准：APR <0.1\nPhone                                              Transsion标准 & 放行标准：APR <0.5\n内核稳定性                                       Transsion标准 & 放行标准：APR <0.24\n系统稳定性                                       Transsion标准 & 放行标准：APR <0.5\n开关机（stucklogo ）                         Transsion标准 & 放行标准：APR <0.5\n三方应用                                          Transsion标准：APR<6.94，三方top10<=0.5\nReboot                                             Transsion标准：APR <0.2\n自研应用                                          Transsion标准：自研应用<2，核心单应用<0.2\n稳定性标准V1.4 ",
    "description": "APR大数据各模块指标在正常范围内\n澄清模板：稳定性相关指标数据汇总 \n注：\n1.确保符合前后端部门共同制定的放行标准。（若后续因放行标准过低引发问题.需由前端部门负责澄清。）\n2.记录APR各模块转维时具体指标达成情况.作为转维后基准值。\n3.达不到放行标准的需要提供风险评估交付件 & 改善方案导入完成。（参考模板：软件风险评估报告模板  ）",
    "remark": "",
    "owner": "开发"
  },
  {
    "sourceRow": 8,
    "seq": "V-06",
    "type": "准入条件",
    "standard": "NPS调研：完成top5问题分析及方案导入",
    "description": "NPS调研问卷问题方案已导入MR版本\n注：上市3~6个月NPS调研，需要在项目转维前完成分析改善。（2025年针对调研结果反馈晚于转维时间的项目，接受项目转维后由原项目团队NPS分析改善）",
    "remark": "",
    "owner": "开发"
  },
  {
    "sourceRow": 9,
    "seq": "V-07",
    "type": "准入条件",
    "standard": "ARR指标达成企业标准\n1.超标：方案已导入MR版本",
    "description": "2025年软工FFR/ARR指标拆解\n注：无法继续向下分析问题可澄清\nARR指标评估方向：①.代码修改 ②.下一步计划",
    "remark": "@卢明明超标项目拉出问题清单\n2025年软工ARR月度数据",
    "owner": "开发"
  },
  {
    "sourceRow": 10,
    "seq": "V-08",
    "type": "准入条件",
    "standard": "性能大数据指标达标\n注：\nAndroid 15及以上项目（A14及以前项目无埋点）",
    "description": "\n对应项目的大数据拆解文档(例：上市性能大数据周报 - 04/24",
    "remark": "",
    "owner": "开发"
  },
  {
    "sourceRow": 11,
    "seq": "V-013",
    "type": "准入条件",
    "standard": "行管指标100%达成目标值",
    "description": "动态可用内存、Binder/Looper使用占比",
    "remark": "",
    "owner": "开发"
  },
  {
    "sourceRow": 12,
    "seq": "V-10",
    "type": "准入条件",
    "standard": "功耗大数据指标达标\n",
    "description": "参考：QM-UE-R-006 传音手机功耗大数据体验指标\n1.续航满足率\n2.亮屏掉电速率\n3.灭屏掉电速率\n4.平均亮屏电流\n5.平均灭屏电流",
    "remark": "",
    "owner": "开发"
  },
  {
    "sourceRow": 13,
    "seq": "V-11",
    "type": "准入条件",
    "standard": "多供、市场需求、新功能导入完成",
    "description": "1.已知多供、新增市场需求导入完成\n2.随项目开发的新软件功能不随项目转维，由原项目团队负责到准出，维护SPM跟进导入维护版本\n3.分支收编正在进行中，不进行转维动作",
    "remark": "",
    "owner": "SPM"
  },
  {
    "sourceRow": 14,
    "seq": "V-12",
    "type": "单独跟进",
    "standard": "评审结束后当天完成所有维护领域权限修改",
    "description": "SPUG、售后问题系统、IPM系统项目团队成员更新、Jira责任团队切换、SCM软件配置管理平台、Transcend研发需求管理平台等。",
    "remark": "",
    "owner": "SPM"
  }
]

/** “开发”按确认的现有职责拆为底软、系统；每个责任人占一条，保留原序号和文本。 */
export function splitTransferTemplateOwners(owner: string): string[] {
  return owner.split(/[,，、;；\n]+/).map(value => value.trim()).filter(Boolean)
    .flatMap(value => value === '开发' ? ['底软', '系统'] : [value.replace(/^tOS\s+/, '')])
}
const roleFields = (role: string) => ({ responsibleRole: role, entryRole: `在研${role}`, reviewRole: `维护${role}`, aiCheckRule: '' })
const checklist = (source: typeof WHOLE_CHECKLIST_SOURCE): CheckListTemplate[] => source.flatMap(row =>
  splitTransferTemplateOwners(row.owner).map(role => ({ seq: row.seq, type: row.type, checkItem: row.checkItem.trim(), ...roleFields(role) }))
).map((row, index) => ({ ...row, id: index + 1 }))
export const MOCK_CHECKLIST_TEMPLATES = checklist(WHOLE_CHECKLIST_SOURCE)
export const MOCK_TOS_CHECKLIST_TEMPLATES = checklist(TOS_CHECKLIST_SOURCE)
export const MOCK_REVIEW_ELEMENT_TEMPLATES: ReviewElementTemplate[] = WHOLE_REVIEW_SOURCE.flatMap(row =>
  splitTransferTemplateOwners(row.owner).map(role => ({ seq: row.seq, type: row.type, standard: row.standard.trim(), description: row.description.trim(), remark: row.remark.trim(), ...roleFields(role) }))
).map((row, index) => ({ ...row, id: index + 1 }))
