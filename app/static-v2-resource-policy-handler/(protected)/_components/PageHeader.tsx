import { cn } from '@/lib/utils'

interface PageHeaderProps {
    title: string
    subtitle?: string
    children?: React.ReactNode
}

export default function PageHeader({ title, subtitle, children }: PageHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <div className="h-px w-8 bg-[#d4af37]" />
                    <span className="text-[11px] font-extrabold tracking-[0.3em] uppercase text-[#d4af37]">
                        Reveil Administration
                    </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black flex items-baseline gap-2">
                    {title}
                    <span className="w-2.5 h-2.5 bg-[#d4af37] rounded-full" />
                </h1>
                {subtitle && (
                    <p className="text-gray-500 text-sm font-semibold tracking-wide">
                        {subtitle}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
                {children}
            </div>
        </div>
    )
}
