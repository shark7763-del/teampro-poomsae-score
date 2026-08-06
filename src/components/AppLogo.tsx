export function AppLogo({ compact = false }: { compact?: boolean }): React.ReactElement {
  return (
    <div className={compact ? 'app-logo compact' : 'app-logo'}>
      <img src={`${import.meta.env.BASE_URL}teampro-poomsae-coach-logo.png`} alt="TeamPro Poomsae Coach" />
      <span>TEAMPRO</span>
    </div>
  )
}
