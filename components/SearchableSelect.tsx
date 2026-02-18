import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
    id: string;
    label: string;
    subLabel?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    required?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = "Select...",
    label,
    required = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    // Reset search when opening & Focus
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            setTimeout(() => {
                if (inputRef.current) inputRef.current.focus();
            }, 50);
        }
    }, [isOpen]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        return options.filter(option =>
            option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (option.subLabel && option.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [options, searchTerm]);

    const selectedOption = options.find(o => o.id === value);

    return (
        <div className="space-y-1.5" ref={wrapperRef}>
            {label && <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>}
            <div className="relative">
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full p-3 border rounded-xl bg-slate-50 font-bold text-xs text-slate-700 flex justify-between items-center cursor-pointer transition-all ${isOpen ? 'ring-2 ring-blue-500 border-transparent bg-white' : 'border-slate-200 hover:border-slate-300'}`}
                >
                    <span className={!selectedOption ? "text-slate-400" : ""}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>

                {isOpen && (
                    <div className="absolute top-[110%] left-0 right-0 bg-white rounded-xl shadow-2xl border border-slate-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-3 border-b border-slate-100 bg-slate-50">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Type to search..."
                                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:font-medium text-slate-700"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                            {filteredOptions.length > 0 ? (
                                filteredOptions.map(option => (
                                    <div
                                        key={option.id}
                                        onClick={() => {
                                            onChange(option.id);
                                            setIsOpen(false);
                                        }}
                                        className={`flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-colors ${value === option.id ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'hover:bg-slate-50 text-slate-700 border border-transparent'}`}
                                    >
                                        <div>
                                            <div className="font-bold text-xs">{option.label}</div>
                                            {option.subLabel && <div className="text-[10px] font-medium opacity-70 mt-0.5">{option.subLabel}</div>}
                                        </div>
                                        {value === option.id && <Check size={14} className="text-blue-600" />}
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">No results found</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchableSelect;
