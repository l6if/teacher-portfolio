'use client'

import {
  LayoutDashboard, FolderOpen, LibraryBig, FileText, Route, Users, Plus, Search,
  ChevronDown, ChevronLeft, ChevronRight, X, Check, Trash2, Pencil, Eye, Upload,
  Link2, ExternalLink, Image, Video, Table, Paperclip, Download, Printer,
  MoreHorizontal, Calendar, Clock, Award, Trophy, Sparkles, Rocket, GraduationCap,
  HeartPulse, ClipboardCheck, NotebookPen, Target, Lightbulb, TrendingUp,
  UserRound, CalendarDays, PenLine, Map, School, PartyPopper, CircleDashed,
  CircleCheck, CircleAlert, Filter, LayoutGrid, List, Loader2, Wand2, Link,
  Unlink, Archive, ArchiveRestore, Building2, BookOpen, Star, ArrowRight,
  ArrowLeft, FileUp, Info, CheckCircle2, Copy, Send, Bookmark, Layers,
  ClipboardList, FolderKanban, BadgeCheck, LogOut, RefreshCw, SquarePen,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, FolderOpen, LibraryBig, FileText, Route, Users, Plus, Search,
  ChevronDown, ChevronLeft, ChevronRight, X, Check, Trash2, Pencil, Eye, Upload,
  Link2, ExternalLink, Image, Video, Table, Paperclip, Download, Printer,
  MoreHorizontal, Calendar, Clock, Award, Trophy, Sparkles, Rocket, GraduationCap,
  HeartPulse, ClipboardCheck, NotebookPen, Target, Lightbulb, TrendingUp,
  UserRound, CalendarDays, PenLine, Map, School, PartyPopper, CircleDashed,
  CircleCheck, CircleAlert, Filter, LayoutGrid, List, Loader2, Wand2, Link,
  Unlink, Archive, ArchiveRestore, Building2, BookOpen, Star, ArrowRight,
  ArrowLeft, FileUp, Info, CheckCircle2, Copy, Send, Bookmark, Layers,
  ClipboardList, FolderKanban, BadgeCheck, LogOut, RefreshCw, SquarePen,
}

export function Icon({ name, className, strokeWidth = 2 }: { name: string; className?: string; strokeWidth?: number }) {
  const C = ICONS[name] ?? CircleDashed
  return <C className={className} strokeWidth={strokeWidth} aria-hidden="true" />
}
